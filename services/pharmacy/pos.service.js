const { Invoice, Medicine, MedicineBatch, Customer, StockLog, Branch, User, mongoose } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { PAYMENT_MODES, PAYMENT_STATUS, STOCK_TRANSACTION_TYPES, STOCK_LOG_TYPES } = require('../../config/pharmacyConstants');
const { emitToBranch } = require('../../socket/pharmacyEvents');


const generateInvoiceNumber = async (branchId) => {
    const branch = await Branch.findById(branchId);
    const branchCode = branch ? branch.code : 'MC';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${branchCode}-${dateStr}-${randomSuffix}`;
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

    // Resolve or auto-create customer if phone number is provided without customer_id
    let resolvedCustomerId = customer_id || null;
    const phoneInput = (customer_phone || patient_phone || '').trim();
    const customerNameInput = (patient_name || 'Walk-in Customer').trim();

    if (!resolvedCustomerId && phoneInput) {
        let existingCustomer = await Customer.findOne({
            branch_id: branchId,
            phone: phoneInput,
        });

        if (!existingCustomer) {
            existingCustomer = await Customer.create({
                branch_id: branchId,
                name: customerNameInput,
                phone: phoneInput,
                khata_balance: 0,
            });
        }
        resolvedCustomerId = existingCustomer._id;
    }

    let subtotal = 0;
    let totalDiscount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let grandTotal = 0;

    const preparedInvoiceItems = [];
    const lowStockAlerts = [];
    const updatedBatches = [];
    const createdLogs = [];

    for (const item of items) {
        const { medicine_id, batch_id, quantity, discount_percent = 0 } = item;

        const batch = await MedicineBatch.findOne({
            _id: batch_id,
            medicine_id,
            branch_id: branchId,
        }).populate('medicine');

        if (!batch) {
            throw new ApiError(404, `Batch ID ${batch_id} not found for medicine ${medicine_id}`, 'BATCH_NOT_FOUND');
        }

        if (batch.current_stock < quantity) {
            throw new ApiError(
                400,
                `Insufficient stock for ${batch.medicine ? batch.medicine.name : 'Medicine'} (Batch: ${batch.batch_number}). Available: ${batch.current_stock}, Requested: ${quantity}`,
                'INSUFFICIENT_STOCK'
            );
        }

        const unitPrice = parseFloat(batch.sale_price || batch.mrp);
        const lineSubtotal = unitPrice * quantity;
        const discPercent = parseFloat(discount_percent || 0);
        const lineDiscount = (lineSubtotal * discPercent) / 100;
        const taxableAmount = lineSubtotal - lineDiscount;

        const gstRate = parseFloat(batch.gst_rate || 12);
        const gstAmount = (taxableAmount * gstRate) / 100;
        const lineTotal = taxableAmount + gstAmount;

        subtotal += lineSubtotal;
        totalDiscount += lineDiscount;
        totalCgst += gstAmount / 2;
        totalSgst += gstAmount / 2;
        grandTotal += lineTotal;

        const newStock = batch.current_stock - quantity;
        batch.current_stock = newStock;
        await batch.save();
        updatedBatches.push(batch);

        preparedInvoiceItems.push({
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
        });

        const log = await StockLog.create({
            branch_id: branchId,
            medicine_id: batch.medicine_id,
            batch_id: batch._id,
            type: STOCK_TRANSACTION_TYPES?.SALE_OUT || STOCK_LOG_TYPES.SALE_OUT,
            quantity: -quantity,
            balance_after: newStock,
            remarks: 'POS Sale',
            created_by_user_id: userId,
        });
        createdLogs.push(log);

        if (batch.medicine && newStock <= (batch.medicine.low_stock_threshold || 10)) {
            lowStockAlerts.push({
                medicineId: batch.medicine_id.toString(),
                name: batch.medicine.name,
                stock: newStock,
                threshold: batch.medicine.low_stock_threshold,
            });
        }
    }

    const invoiceNumber = await generateInvoiceNumber(branchId);
    const roundedGrandTotal = Math.round(grandTotal * 100) / 100;

    let paidAmount = amount_paid !== undefined ? parseFloat(amount_paid) : roundedGrandTotal;
    if (payment_mode === PAYMENT_MODES.KHATA) {
        paidAmount = 0;
    }

    const balanceDue = Math.max(0, roundedGrandTotal - paidAmount);

    let paymentStatus = PAYMENT_STATUS.COMPLETED || PAYMENT_STATUS.PAID;
    if (balanceDue > 0 && paidAmount > 0) {
        paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID || 'PARTIALLY_PAID';
    } else if (balanceDue > 0 && paidAmount === 0) {
        paymentStatus = PAYMENT_STATUS.PENDING;
    }

    const newInvoice = await Invoice.create({
        branch_id: branchId,
        customer_id: resolvedCustomerId,
        invoice_number: invoiceNumber,
        invoice_date: new Date(),
        patient_name: customerNameInput,
        doctor_name: doctor_name || null,
        subtotal: Math.round(subtotal * 100) / 100,
        discount_amount: Math.round(totalDiscount * 100) / 100,
        total_tax: Math.round((totalCgst + totalSgst) * 100) / 100,
        cgst_amount: Math.round(totalCgst * 100) / 100,
        sgst_amount: Math.round(totalSgst * 100) / 100,
        igst_amount: 0.0,
        grand_total: roundedGrandTotal,
        amount_paid: paidAmount,
        balance_due: balanceDue,
        payment_mode: payment_mode || PAYMENT_MODES.CASH,
        payment_status: paymentStatus,
        notes: notes || null,
        created_by_user_id: userId,
        items: preparedInvoiceItems,
    });

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

const returnInvoiceItems = async (branchId, userId, invoiceId, items = []) => {
    const invoice = await Invoice.findOne({ _id: invoiceId, branch_id: branchId });
    if (!invoice) {
        throw new ApiError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
    }

    let totalRefund = 0;
    const returnedItemsResult = [];

    for (const item of items) {
        const medicineId = item.medicine_id;
        const qtyToReturn = parseInt(item.quantity, 10) || 1;
        const reason = item.reason || 'Customer Return';

        const medicine = await Medicine.findById(medicineId);
        const batch = await MedicineBatch.findOne({ medicine_id: medicineId, branch_id: branchId }).sort({ expiry_date: -1 });

        if (batch) {
            batch.current_stock += qtyToReturn;
            await batch.save();

            await StockLog.create({
                branch_id: branchId,
                medicine_id: medicineId,
                batch_id: batch._id,
                type: 'RETURN_IN',
                quantity: qtyToReturn,
                balance_after: batch.current_stock,
                remarks: `Return on invoice ${invoice.invoice_number}: ${reason}`,
                created_by_user_id: userId,
            });
        }

        const unitPrice = medicine ? (medicine.sale_price || medicine.mrp || 0) : 0;
        const refundItemAmount = unitPrice * qtyToReturn;
        totalRefund += refundItemAmount;

        returnedItemsResult.push({
            medicine_id: medicineId,
            medicine_name: medicine ? medicine.name : '',
            quantity: qtyToReturn,
            refund_amount: refundItemAmount,
            reason,
        });
    }

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

