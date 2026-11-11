const { Invoice, Medicine, MedicineBatch, Customer, StockLog, Branch, User, mongoose } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { PAYMENT_MODES, PAYMENT_STATUS, STOCK_TRANSACTION_TYPES, STOCK_LOG_TYPES } = require('../../config/pharmacyConstants');
const { emitToBranch } = require('../../socket/pharmacyEvents');
const { createWithInvoiceNumber } = require('./invoiceNumber');


const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// GST % for a line: the stored rate (0% is a real rate), 12% only when none is set.
const gstRateOf = (...values) => {
    for (const v of values) {
        if (v !== undefined && v !== null && v !== '' && !Number.isNaN(parseFloat(v))) return parseFloat(v);
    }
    return 12;
};

const createInvoice = async (branchId, userId, payload) => {
    const {
        items,
        customer_id,
        patient_name,
        patient_phone,
        customer_phone,
        doctor_name,
        payment_mode,
        amount_paid,
        notes,
    } = payload;

    if (!items || !items.length) {
        throw new ApiError(400, 'Invoice must contain at least one medicine item', 'ITEMS_REQUIRED');
    }

    const phoneInput = (customer_phone || patient_phone || '').trim();
    const customerNameInput = (patient_name || 'Walk-in Customer').trim();
    // Counter can bill without GST (bill of supply); default is a tax invoice.
    const applyGst = payload.apply_gst !== false && payload.apply_gst !== 'false';

    let subtotal = 0;
    let totalDiscount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let grandTotal = 0;

    // 1. Check and price every line before any stock moves.
    const lines = [];
    const requestedPerBatch = new Map();
    for (const item of items) {
        const { medicine_id, batch_id, discount_percent = 0 } = item;
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new ApiError(400, 'Quantity must be a whole number of at least 1', 'INVALID_QUANTITY');
        }

        const batch = await MedicineBatch.findOne({
            _id: batch_id,
            medicine_id,
            branch_id: branchId,
        }).populate('medicine');

        if (!batch) {
            throw new ApiError(404, `Batch ID ${batch_id} not found for medicine ${medicine_id}`, 'BATCH_NOT_FOUND');
        }

        // The same batch may appear on several lines.
        const batchKey = batch._id.toString();
        const requested = (requestedPerBatch.get(batchKey) || 0) + quantity;
        if (batch.current_stock < requested) {
            throw new ApiError(
                400,
                `Insufficient stock for ${batch.medicine ? batch.medicine.name : 'Medicine'} (Batch: ${batch.batch_number}). Available: ${batch.current_stock}, Requested: ${requested}`,
                'INSUFFICIENT_STOCK'
            );
        }
        requestedPerBatch.set(batchKey, requested);

        const unitPrice = parseFloat(batch.sale_price || batch.mrp);
        const lineSubtotal = unitPrice * quantity;
        const discPercent = parseFloat(discount_percent || 0);
        const lineDiscount = (lineSubtotal * discPercent) / 100;
        const taxableAmount = lineSubtotal - lineDiscount;

        const gstRate = applyGst ? gstRateOf(batch.gst_rate) : 0;
        const gstAmount = (taxableAmount * gstRate) / 100;
        const lineTotal = taxableAmount + gstAmount;

        subtotal += lineSubtotal;
        totalDiscount += lineDiscount;
        totalCgst += gstAmount / 2;
        totalSgst += gstAmount / 2;
        grandTotal += lineTotal;

        lines.push({
            batch,
            quantity,
            invoiceItem: {
                medicine_id: batch.medicine_id,
                batch_id: batch._id,
                medicine_name: batch.medicine ? batch.medicine.name : '',
                batch_number: batch.batch_number,
                expiry_date: batch.expiry_date,
                hsn_code: batch.medicine ? batch.medicine.hsn_code : '',
                quantity,
                unit_price: unitPrice,
                mrp: batch.mrp,
                discount_percent: discPercent,
                discount_amount: lineDiscount,
                gst_rate: gstRate,
                gst_amount: gstAmount,
                total_amount: lineTotal,
            },
        });
    }

    const roundedGrandTotal = round2(grandTotal);

    let paidAmount = amount_paid !== undefined && amount_paid !== null && amount_paid !== '' ? parseFloat(amount_paid) : roundedGrandTotal;
    if (payment_mode === PAYMENT_MODES.KHATA) {
        paidAmount = 0;
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        throw new ApiError(400, 'amount_paid must be a positive number', 'INVALID_AMOUNT');
    }
    // Cash handed over beyond the bill is change, not payment.
    paidAmount = round2(Math.min(paidAmount, roundedGrandTotal));
    const balanceDue = round2(Math.max(0, roundedGrandTotal - paidAmount));

    let paymentStatus = PAYMENT_STATUS.COMPLETED || PAYMENT_STATUS.PAID;
    if (balanceDue > 0 && paidAmount > 0) {
        paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID || 'PARTIALLY_PAID';
    } else if (balanceDue > 0 && paidAmount === 0) {
        paymentStatus = PAYMENT_STATUS.PENDING;
    }

    // 2. Credit needs someone to owe it.
    let resolvedCustomerId = customer_id || null;
    let existingCustomer = null;
    if (!resolvedCustomerId && phoneInput) {
        existingCustomer = await Customer.findOne({ branch_id: branchId, phone: phoneInput });
        if (existingCustomer) resolvedCustomerId = existingCustomer._id;
    }
    if (balanceDue > 0 && !resolvedCustomerId && !phoneInput) {
        throw new ApiError(
            400,
            'Select a customer or enter a phone number to put the balance on khata.',
            'CUSTOMER_REQUIRED_FOR_CREDIT'
        );
    }

    // 3. Take stock atomically; if anything fails, put back what was taken.
    const taken = [];
    let newInvoice;
    try {
        for (const line of lines) {
            const updated = await MedicineBatch.findOneAndUpdate(
                { _id: line.batch._id, branch_id: branchId, current_stock: { $gte: line.quantity } },
                { $inc: { current_stock: -line.quantity } },
                { new: true }
            );
            if (!updated) {
                throw new ApiError(
                    400,
                    `Insufficient stock for ${line.invoiceItem.medicine_name || 'Medicine'} (Batch: ${line.batch.batch_number}). It was just sold elsewhere.`,
                    'INSUFFICIENT_STOCK'
                );
            }
            taken.push(line);
            line.newStock = updated.current_stock;
        }

        // Phone given: save the customer for khata and history.
        if (!resolvedCustomerId && phoneInput) {
            const created = await Customer.create({
                branch_id: branchId,
                name: customerNameInput,
                phone: phoneInput,
                khata_balance: 0,
            });
            resolvedCustomerId = created._id;
        }

        newInvoice = await createWithInvoiceNumber(branchId, (invoiceNumber) => ({
            branch_id: branchId,
            customer_id: resolvedCustomerId,
            invoice_number: invoiceNumber,
            invoice_date: new Date(),
            patient_name: customerNameInput,
            doctor_name: doctor_name || null,
            subtotal: round2(subtotal),
            discount_amount: round2(totalDiscount),
            total_tax: round2(totalCgst + totalSgst),
            cgst_amount: round2(totalCgst),
            sgst_amount: round2(totalSgst),
            igst_amount: 0.0,
            grand_total: roundedGrandTotal,
            gst_applied: applyGst,
            amount_paid: paidAmount,
            balance_due: balanceDue,
            payment_mode: payment_mode || PAYMENT_MODES.CASH,
            payment_status: paymentStatus,
            notes: notes || null,
            created_by_user_id: userId,
            items: lines.map((l) => l.invoiceItem),
        }));
    } catch (err) {
        for (const line of taken) {
            await MedicineBatch.updateOne({ _id: line.batch._id }, { $inc: { current_stock: line.quantity } });
        }
        throw err;
    }

    // 4. Sale is final: stock ledger, khata, alerts.
    const lowStockAlerts = [];
    for (const line of lines) {
        await StockLog.create({
            branch_id: branchId,
            medicine_id: line.batch.medicine_id,
            batch_id: line.batch._id,
            type: STOCK_TRANSACTION_TYPES?.SALE_OUT || STOCK_LOG_TYPES.SALE_OUT,
            quantity: -line.quantity,
            balance_after: line.newStock,
            reference_type: 'INVOICE',
            reference_id: newInvoice._id.toString(),
            remarks: `POS Sale · ${newInvoice.invoice_number}`,
            created_by_user_id: userId,
        });

        const medicine = line.batch.medicine;
        if (medicine && line.newStock <= (medicine.low_stock_threshold || 10)) {
            lowStockAlerts.push({
                medicineId: line.batch.medicine_id.toString(),
                name: medicine.name,
                stock: line.newStock,
                threshold: medicine.low_stock_threshold,
            });
        }
    }

    if (resolvedCustomerId && balanceDue > 0) {
        const customer = await Customer.findOne({ _id: resolvedCustomerId, branch_id: branchId });
        if (customer) {
            customer.khata_balance = (customer.khata_balance || 0) + balanceDue;
            await customer.save();
        }
    }

    emitToBranch(branchId.toString(), 'billing:invoice_created', {
        invoiceId: newInvoice._id.toString(),
        invoiceNumber: newInvoice.invoice_number,
        grandTotal: newInvoice.grand_total,
        patientName: newInvoice.patient_name,
        message: `Invoice ${newInvoice.invoice_number} created (₹${newInvoice.grand_total})`,
    });

    for (const alert of lowStockAlerts) {
        emitToBranch(branchId.toString(), 'inventory:low_stock', {
            medicineId: alert.medicineId,
            medicineName: alert.name,
            currentStock: alert.stock,
            threshold: alert.threshold,
            message: `Low stock: ${alert.name} (Only ${alert.stock} left in stock)`,
        });
    }

    return getInvoiceReceipt(branchId, newInvoice._id);
};

const getInvoiceById = async (branchId, invoiceId) => {
    const invoice = await Invoice.findOne({
        _id: invoiceId,
        branch_id: branchId,
    })
        .populate('customer')
        .populate('branch')
        .populate('created_by', 'full_name email role');

    if (!invoice) {
        throw new ApiError(404, 'Invoice not found in this branch', 'INVOICE_NOT_FOUND');
    }

    return invoice;
};

const getInvoiceReceipt = async (branchId, invoiceId) => {
    const invoice = await Invoice.findOne({
        _id: invoiceId,
        branch_id: branchId,
    })
        .populate('customer')
        .populate('branch')
        .populate('created_by', 'full_name email role phone');

    if (!invoice) {
        throw new ApiError(404, 'Invoice not found in this branch', 'INVOICE_NOT_FOUND');
    }

    const branch = invoice.branch || {};
    const customer = invoice.customer || {};
    const billedBy = invoice.created_by || {};

    const formattedBill = {
        invoice_id: invoice._id.toString(),
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        formatted_date: new Date(invoice.invoice_date).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'short',
        }),
        store_details: {
            name: branch.name || 'Medcab Pharmacy Store',
            code: branch.code || 'MC-STORE',
            address: branch.address || 'Medical Road',
            city: branch.city || '',
            state: branch.state || 'Uttar Pradesh',
            pincode: branch.pincode || '',
            phone: branch.phone || '',
            email: branch.email || '',
            gstin: branch.gstin || '',
            dl_number: branch.dl_number || '',
        },
        customer_details: {
            customer_id: customer._id ? customer._id.toString() : null,
            patient_name: invoice.patient_name || customer.name || 'Walk-in Customer',
            phone: customer.phone || '',
            doctor_name: invoice.doctor_name || '',
            khata_balance: customer.khata_balance || 0,
        },
        billed_by: {
            user_id: billedBy._id ? billedBy._id.toString() : null,
            name: billedBy.full_name || 'Pharmacist Staff',
            role: billedBy.role || 'STAFF',
        },
        items: invoice.items.map((it) => ({
            medicine_id: it.medicine_id ? it.medicine_id.toString() : null,
            batch_id: it.batch_id ? it.batch_id.toString() : null,
            medicine_name: it.medicine_name,
            batch_number: it.batch_number,
            expiry_date: it.expiry_date ? new Date(it.expiry_date).toISOString().slice(0, 10) : '',
            hsn_code: it.hsn_code || '3004',
            quantity: it.quantity,
            unit_price: it.unit_price,
            mrp: it.mrp,
            discount_percent: it.discount_percent || 0,
            discount_amount: it.discount_amount || 0,
            gst_rate: it.gst_rate || 0,
            gst_amount: it.gst_amount || 0,
            total_amount: it.total_amount,
        })),
        bill_summary: {
            subtotal: invoice.subtotal,
            total_discount: invoice.discount_amount,
            taxable_amount: Math.round((invoice.subtotal - invoice.discount_amount) * 100) / 100,
            cgst_amount: invoice.cgst_amount || 0,
            sgst_amount: invoice.sgst_amount || 0,
            total_tax: invoice.total_tax,
            grand_total: invoice.grand_total,
            gst_applied: invoice.gst_applied !== false,
            amount_paid: invoice.amount_paid,
            balance_due: invoice.balance_due,
            payment_mode: invoice.payment_mode,
            payment_status: invoice.payment_status,
        },
        notes: invoice.notes || 'Thank you for choosing Medcab Pharmacy. Get well soon!',
        terms: 'Medicines once sold cannot be returned without original batch and invoice within 7 days.',
    };

    return formattedBill;
};

const getInvoices = async (branchId, query = {}) => {
    const { search, payment_status, customer_id, page = 1, limit = 20 } = query;
    const filter = { branch_id: branchId };

    if (payment_status) {
        filter.payment_status = payment_status;
    }
    if (customer_id) {
        filter.customer_id = customer_id;
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [invoices, total] = await Promise.all([
        Invoice.find(filter)
            .populate('customer', 'name phone')
            .populate('created_by', 'full_name')
            .sort({ invoice_date: -1 })
            .skip(skip)
            .limit(limitNum),
        Invoice.countDocuments(filter),
    ]);

    return {
        invoices,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
    };
};

/**
 * Customer return against an invoice. Only medicines on the invoice can come
 * back, never more than were sold (minus earlier returns). Stock goes back to
 * the batch that was sold and the refund is the billed price per unit
 * (after discount, incl. GST).
 */
const returnInvoiceItems = async (branchId, userId, invoiceId, items = []) => {
    const invoice = await Invoice.findOne({ _id: invoiceId, branch_id: branchId });
    if (!invoice) {
        throw new ApiError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
    }

    // 1. Plan the return against the invoice lines (all-or-nothing).
    const plan = [];
    const plannedPerLine = new Map();
    for (const item of items || []) {
        const qtyToReturn = Number(item.quantity);
        if (qtyToReturn === 0) continue; // line left untouched in the return form
        if (!Number.isInteger(qtyToReturn) || qtyToReturn < 0) {
            throw new ApiError(400, 'Return quantity must be a whole number', 'INVALID_QUANTITY');
        }
        const reason = item.reason || 'Customer Return';

        const candidates = invoice.items
            .map((line, index) => ({ line, index }))
            .filter(({ line }) =>
                String(line.medicine_id) === String(item.medicine_id) &&
                (!item.batch_id || String(line.batch_id) === String(item.batch_id)));
        if (!candidates.length) {
            throw new ApiError(400, `This medicine is not on invoice ${invoice.invoice_number}`, 'ITEM_NOT_ON_INVOICE');
        }

        let left = qtyToReturn;
        for (const { line, index } of candidates) {
            const returnable = line.quantity - (line.returned_quantity || 0) - (plannedPerLine.get(index) || 0);
            if (returnable <= 0) continue;
            const take = Math.min(returnable, left);
            plannedPerLine.set(index, (plannedPerLine.get(index) || 0) + take);
            plan.push({ line, quantity: take, reason });
            left -= take;
            if (left === 0) break;
        }
        if (left > 0) {
            const sold = candidates.reduce((s, { line }) => s + line.quantity, 0);
            const alreadyBack = candidates.reduce((s, { line }) => s + (line.returned_quantity || 0), 0);
            throw new ApiError(
                400,
                `Only ${sold - alreadyBack} of ${sold} unit(s) can still be returned on invoice ${invoice.invoice_number}`,
                'RETURN_EXCEEDS_SOLD'
            );
        }
    }
    if (!plan.length) {
        throw new ApiError(400, 'Enter a return quantity for at least one item', 'ITEMS_REQUIRED');
    }
    for (const p of plan) {
        if (!(await MedicineBatch.exists({ _id: p.line.batch_id, branch_id: branchId }))) {
            throw new ApiError(400, `Batch ${p.line.batch_number || ''} of this invoice no longer exists`, 'BATCH_NOT_FOUND');
        }
    }

    // 2. Apply: stock back to the sold batch, ledger, invoice counters.
    let totalRefund = 0;
    const returnedItemsResult = [];
    for (const { line, quantity, reason } of plan) {
        const batch = await MedicineBatch.findOneAndUpdate(
            { _id: line.batch_id, branch_id: branchId },
            { $inc: { current_stock: quantity } },
            { new: true }
        );

        await StockLog.create({
            branch_id: branchId,
            medicine_id: line.medicine_id,
            batch_id: line.batch_id,
            type: 'RETURN_IN',
            quantity,
            balance_after: batch.current_stock,
            reference_type: 'INVOICE_RETURN',
            reference_id: invoice._id.toString(),
            remarks: `Return on invoice ${invoice.invoice_number}: ${reason}`,
            created_by_user_id: userId,
        });

        const refundItemAmount = round2((line.total_amount / line.quantity) * quantity);
        totalRefund = round2(totalRefund + refundItemAmount);
        line.returned_quantity = (line.returned_quantity || 0) + quantity;

        let medicineName = line.medicine_name;
        if (!medicineName) {
            const medicine = await Medicine.findById(line.medicine_id).select('name');
            medicineName = medicine ? medicine.name : '';
        }
        returnedItemsResult.push({
            medicine_id: line.medicine_id,
            batch_id: line.batch_id,
            medicine_name: medicineName,
            quantity,
            refund_amount: refundItemAmount,
            reason,
        });
    }

    invoice.refunded_amount = round2((invoice.refunded_amount || 0) + totalRefund);
    await invoice.save();

    return {
        invoice_id: invoice._id.toString(),
        invoice_number: invoice.invoice_number,
        returned_items: returnedItemsResult,
        refund_amount: totalRefund,
        message: 'Return and refund processed successfully',
    };
};

const getDailyRegisterSummary = async (branchId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const invoices = await Invoice.find({
        branch_id: branchId,
        invoice_date: { $gte: today, $lt: tomorrow },
    }).sort({ invoice_date: -1 });

    let totalSales = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let creditSales = 0;
    let totalTax = 0;

    for (const inv of invoices) {
        totalSales += inv.grand_total || 0;
        totalTax += inv.total_tax || 0;
        const mode = (inv.payment_mode || '').toUpperCase();
        if (mode === 'CASH') cashSales += inv.grand_total || 0;
        else if (mode === 'UPI') upiSales += inv.grand_total || 0;
        else if (mode === 'CARD') cardSales += inv.grand_total || 0;
        else if (mode === 'CREDIT' || mode === 'KHATA') creditSales += inv.grand_total || 0;
    }

    return {
        date: today.toISOString().split('T')[0],
        total_invoices: invoices.length,
        total_sales: Math.round(totalSales * 100) / 100,
        cash_sales: Math.round(cashSales * 100) / 100,
        upi_sales: Math.round(upiSales * 100) / 100,
        card_sales: Math.round(cardSales * 100) / 100,
        credit_sales: Math.round(creditSales * 100) / 100,
        total_tax: Math.round(totalTax * 100) / 100,
        invoices: invoices.map(i => ({
            id: i._id.toString(),
            invoice_number: i.invoice_number,
            grand_total: i.grand_total,
            payment_mode: i.payment_mode,
            invoice_date: i.invoice_date,
        })),
    };
};

module.exports = {
    createInvoice,
    getInvoiceById,
    getInvoiceReceipt,
    getInvoices,
    returnInvoiceItems,
    getDailyRegisterSummary,
};

