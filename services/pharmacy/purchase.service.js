const mongoose = require('mongoose');
const { Medicine, MedicineBatch, StockLog, Supplier, Purchase, PurchaseReturn } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { STOCK_TRANSACTION_TYPES } = require('../../config/pharmacyConstants');
const { emitToBranch } = require('../../socket/pharmacyEvents');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v, fallback = 0) => {
    if (v === undefined || v === null || v === '') return fallback;
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
};
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Suppliers ───────────────────────────────────────────────────────────────

const createSupplier = async (branchId, payload) => {
    const name = String(payload.name || '').trim();
    if (!name) throw new ApiError(400, 'Supplier name is required', 'SUPPLIER_NAME_REQUIRED');

    const existing = await Supplier.findOne({ branch_id: branchId, name: new RegExp(`^${escapeRegex(name)}$`, 'i'), is_active: true });
    if (existing) throw new ApiError(409, `Supplier '${existing.name}' already exists`, 'SUPPLIER_EXISTS');

    return Supplier.create({
        branch_id: branchId,
        name,
        contact_person: payload.contact_person || '',
        phone: payload.phone || '',
        email: payload.email || '',
        gstin: payload.gstin || '',
        dl_number: payload.dl_number || '',
        address: payload.address || '',
        notes: payload.notes || '',
    });
};

const updateSupplier = async (branchId, supplierId, payload) => {
    const supplier = await Supplier.findOne({ _id: supplierId, branch_id: branchId });
    if (!supplier) throw new ApiError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');
    for (const key of ['name', 'contact_person', 'phone', 'email', 'gstin', 'dl_number', 'address', 'notes']) {
        if (payload[key] !== undefined) supplier[key] = payload[key];
    }
    if (payload.is_active !== undefined) supplier.is_active = payload.is_active === true || payload.is_active === 'true';
    if (!String(supplier.name || '').trim()) throw new ApiError(400, 'Supplier name is required', 'SUPPLIER_NAME_REQUIRED');
    await supplier.save();
    return supplier;
};

/** Outstanding payable per supplier (sum of balance_due of their bills). */
const outstandingBySupplier = async (branchId, supplierIds = null) => {
    const match = { branch_id: new mongoose.Types.ObjectId(branchId), balance_due: { $gt: 0 }, status: { $ne: 'CANCELLED' } };
    if (supplierIds) match.supplier_id = { $in: supplierIds };
    const rows = await Purchase.aggregate([
        { $match: match },
        { $group: { _id: '$supplier_id', outstanding: { $sum: '$balance_due' }, bills: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), { outstanding: round2(r.outstanding), unpaid_bills: r.bills }]));
};

const getSuppliers = async (branchId, query = {}) => {
    const { search, include_inactive } = query;
    const filter = { branch_id: branchId };
    if (!(include_inactive === 'true' || include_inactive === true)) filter.is_active = true;
    if (search) {
        const regex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ name: regex }, { phone: regex }, { gstin: regex }, { contact_person: regex }];
    }
    const suppliers = await Supplier.find(filter).sort({ name: 1 }).limit(500);
    const outstanding = await outstandingBySupplier(branchId, suppliers.map((s) => s._id));
    return suppliers.map((s) => {
        const j = s.toJSON();
        const o = outstanding.get(s._id.toString());
        j.outstanding = o ? o.outstanding : 0;
        j.unpaid_bills = o ? o.unpaid_bills : 0;
        return j;
    });
};

const getSupplierById = async (branchId, supplierId) => {
    const supplier = await Supplier.findOne({ _id: supplierId, branch_id: branchId });
    if (!supplier) throw new ApiError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');
    const purchases = await Purchase.find({ branch_id: branchId, supplier_id: supplier._id })
        .sort({ invoice_date: -1 })
        .limit(20)
        .select('-items');
    const totals = await Purchase.aggregate([
        { $match: { branch_id: new mongoose.Types.ObjectId(branchId), supplier_id: supplier._id, status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, total: { $sum: '$grand_total' }, paid: { $sum: '$amount_paid' }, due: { $sum: '$balance_due' }, bills: { $sum: 1 } } },
    ]);
    const t = totals[0] || { total: 0, paid: 0, due: 0, bills: 0 };
    const j = supplier.toJSON();
    j.total_purchases = round2(t.total);
    j.total_paid = round2(t.paid);
    j.outstanding = round2(t.due);
    j.bills = t.bills;
    j.purchases = purchases;
    return j;
};

/**
 * Supplier ledger: bills as debits, payments as credits, in date order with a
 * running balance. Payments made on a since-cancelled bill still appear
 * (they are money the supplier owes back).
 */
const getSupplierLedger = async (branchId, supplierId) => {
    const supplier = await Supplier.findOne({ _id: supplierId, branch_id: branchId });
    if (!supplier) throw new ApiError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');

    const purchases = await Purchase.find({ branch_id: branchId, supplier_id: supplier._id })
        .sort({ invoice_date: 1, created_at: 1 })
        .select('purchase_number supplier_invoice_number invoice_date grand_total amount_paid balance_due payment_status status payments items created_at');

    const entries = [];
    for (const p of purchases) {
        if (p.status !== 'CANCELLED') {
            entries.push({
                date: p.invoice_date,
                type: 'BILL',
                purchase_id: p._id,
                purchase_number: p.purchase_number,
                reference: p.supplier_invoice_number || '',
                particulars: `Bill ${p.supplier_invoice_number || p.purchase_number} · ${p.items.length} item${p.items.length === 1 ? '' : 's'}`,
                debit: round2(p.grand_total),
                credit: 0,
                payment_status: p.payment_status,
            });
        }
        for (const pay of p.payments || []) {
            if (pay.mode === 'DEBIT_NOTE') continue; // shown via the return entry below
            entries.push({
                date: pay.paid_at || p.created_at,
                type: 'PAYMENT',
                purchase_id: p._id,
                purchase_number: p.purchase_number,
                reference: pay.reference || '',
                particulars: `Paid by ${pay.mode}${pay.reference ? ` · ${pay.reference}` : ''} against ${p.purchase_number}${p.status === 'CANCELLED' ? ' (bill cancelled — refund due)' : ''}`,
                debit: 0,
                credit: round2(pay.amount),
                mode: pay.mode,
            });
        }
    }
    const returns = await PurchaseReturn.find({ branch_id: branchId, supplier_id: supplier._id }).sort({ return_date: 1 });
    for (const r of returns) {
        entries.push({
            date: r.return_date,
            type: 'RETURN',
            return_id: r._id,
            purchase_id: r.purchase_id,
            purchase_number: r.purchase_number,
            reference: r.debit_note_number,
            particulars: `Debit note ${r.debit_note_number} · ${r.items.length} item${r.items.length === 1 ? '' : 's'} returned${r.purchase_number ? ` (${r.purchase_number})` : ''} · ${r.settlement === 'ADJUST_PAYABLE' ? 'adjusted' : r.settlement === 'REFUND' ? 'refunded' : 'credit note pending'}`,
            debit: 0,
            credit: round2(r.grand_total),
            settlement: r.settlement,
        });
    }

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = 0;
    for (const e of entries) {
        balance = round2(balance + e.debit - e.credit);
        e.balance = balance;
    }

    const totalBilled = round2(entries.reduce((s, e) => s + e.debit, 0));
    const totalPaid = round2(entries.filter((e) => e.type === 'PAYMENT').reduce((s, e) => s + e.credit, 0));
    const totalReturned = round2(entries.filter((e) => e.type === 'RETURN').reduce((s, e) => s + e.credit, 0));
    const unpaid = purchases.filter((p) => p.status !== 'CANCELLED' && p.balance_due > 0);
    return {
        supplier: supplier.toJSON(),
        totals: {
            billed: totalBilled,
            paid: totalPaid,
            returned: totalReturned,
            balance: round2(totalBilled - totalPaid - totalReturned),
            outstanding: round2(unpaid.reduce((s, p) => s + p.balance_due, 0)),
            unpaid_bills: unpaid.length,
            bills: purchases.filter((p) => p.status !== 'CANCELLED').length,
        },
        entries,
    };
};

/**
 * One payment to a supplier spread across their unpaid bills, oldest first
 * (or exactly as `allocations: [{purchase_id, amount}]` says).
 */
const paySupplier = async (branchId, supplierId, user, payload = {}) => {
    const supplier = await Supplier.findOne({ _id: supplierId, branch_id: branchId });
    if (!supplier) throw new ApiError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');

    const mode = String(payload.mode || payload.payment_mode || 'CASH').toUpperCase();
    if (!Purchase.CASH_MODES.includes(mode)) {
        throw new ApiError(400, 'mode must be CASH, UPI, BANK or CHEQUE', 'INVALID_PAYMENT_MODE');
    }
    const paidAt = payload.paid_at ? new Date(payload.paid_at) : new Date();
    const reference = String(payload.reference || '').trim();
    const note = String(payload.note || '').trim();
    const userId = user?.userId || user?.id || null;

    const unpaid = await Purchase.find({ branch_id: branchId, supplier_id: supplier._id, status: { $ne: 'CANCELLED' }, balance_due: { $gt: 0 } })
        .sort({ invoice_date: 1, created_at: 1 });
    const outstanding = round2(unpaid.reduce((s, p) => s + p.balance_due, 0));

    // Build the allocation plan.
    let plan = [];
    if (Array.isArray(payload.allocations) && payload.allocations.length) {
        for (const a of payload.allocations) {
            const p = unpaid.find((u) => u._id.toString() === String(a.purchase_id));
            const amt = round2(num(a.amount, 0));
            if (!p) throw new ApiError(400, `Purchase ${a.purchase_id} is not an unpaid bill of this supplier`, 'INVALID_ALLOCATION');
            if (amt <= 0 || amt > p.balance_due + 0.005) throw new ApiError(400, `Allocation for ${p.purchase_number} must be between 0 and ${p.balance_due}`, 'INVALID_ALLOCATION');
            plan.push({ purchase: p, amount: amt });
        }
    } else {
        let remaining = round2(num(payload.amount, 0));
        if (remaining <= 0) throw new ApiError(400, 'Payment amount must be greater than 0', 'INVALID_AMOUNT');
        if (remaining > outstanding + 0.005) throw new ApiError(400, `Amount exceeds outstanding (${outstanding})`, 'AMOUNT_EXCEEDS_DUE');
        for (const p of unpaid) {
            if (remaining <= 0) break;
            const amt = round2(Math.min(remaining, p.balance_due));
            plan.push({ purchase: p, amount: amt });
            remaining = round2(remaining - amt);
        }
    }

    const allocated = [];
    for (const { purchase, amount } of plan) {
        purchase.payments.push({ amount, mode, reference, note, paid_at: paidAt, created_by: userId });
        purchase.amount_paid = round2(purchase.amount_paid + amount);
        purchase.balance_due = round2(Math.max(0, purchase.grand_total - purchase.amount_paid));
        purchase.payment_status = paymentStatusFor(purchase.grand_total, purchase.amount_paid);
        await purchase.save();
        allocated.push({ purchase_id: purchase._id, purchase_number: purchase.purchase_number, amount, balance_due: purchase.balance_due, payment_status: purchase.payment_status });
    }

    const total = round2(allocated.reduce((s, a) => s + a.amount, 0));
    return {
        supplier_id: supplier._id,
        supplier_name: supplier.name,
        amount: total,
        mode,
        allocated,
        outstanding_after: round2(outstanding - total),
    };
};

// ─── Purchases ───────────────────────────────────────────────────────────────

const nextPurchaseNumber = async (branchId, invoiceDate) => {
    const d = invoiceDate ? new Date(invoiceDate) : new Date();
    const prefix = `PUR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-`;
    const last = await Purchase.findOne({ branch_id: branchId, purchase_number: new RegExp(`^${prefix}`) })
        .sort({ purchase_number: -1 })
        .select('purchase_number');
    const seq = last ? parseInt(last.purchase_number.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
};

const paymentStatusFor = (grandTotal, paid) => {
    if (grandTotal <= 0 || paid >= grandTotal - 0.005) return 'PAID';
    if (paid > 0) return 'PARTIAL';
    return 'UNPAID';
};

/**
 * Records a supplier bill: validates every line, inwards stock into the
 * batch (existing batch number → add stock, else new batch), logs
 * PURCHASE_IN, refreshes medicine prices and stores the bill with payables.
 */
const createPurchase = async (branchId, user, payload) => {
    const userId = user?.userId || user?.id || null;
    const { items, notes, supplier_invoice_number, invoice_date, payment_mode = 'CREDIT', update_prices = true } = payload;

    if (!Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'Add at least one item to the purchase', 'ITEMS_REQUIRED');
    }
    if (items.length > 200) {
        throw new ApiError(400, 'A purchase can have at most 200 lines', 'TOO_MANY_ITEMS');
    }

    // Supplier: existing id or inline new supplier.
    let supplier = null;
    if (payload.supplier_id) {
        supplier = await Supplier.findOne({ _id: payload.supplier_id, branch_id: branchId });
        if (!supplier) throw new ApiError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');
    } else if (payload.supplier && payload.supplier.name) {
        supplier = await Supplier.findOne({ branch_id: branchId, name: new RegExp(`^${escapeRegex(payload.supplier.name.trim())}$`, 'i') });
        if (!supplier) supplier = await createSupplier(branchId, payload.supplier);
    } else {
        throw new ApiError(400, 'supplier_id (or a new supplier with a name) is required', 'SUPPLIER_REQUIRED');
    }

    const invoiceDate = invoice_date ? new Date(invoice_date) : new Date();
    if (isNaN(invoiceDate.getTime())) throw new ApiError(400, 'Invalid invoice_date', 'INVALID_DATE');

    // Same supplier bill entered twice? The client may confirm with allow_duplicate.
    const billNo = String(supplier_invoice_number || '').trim();
    if (billNo && payload.allow_duplicate !== true) {
        const dup = await Purchase.findOne({
            branch_id: branchId,
            supplier_id: supplier._id,
            status: { $ne: 'CANCELLED' },
            supplier_invoice_number: new RegExp(`^${escapeRegex(billNo)}$`, 'i'),
        }).select('purchase_number invoice_date grand_total');
        if (dup) {
            throw new ApiError(
                409,
                `Bill ${billNo} from ${supplier.name} is already recorded as ${dup.purchase_number} (${dup.grand_total})`,
                'DUPLICATE_SUPPLIER_BILL'
            );
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate everything before touching stock.
    const prepared = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const row = i + 1;
        const medicine = await Medicine.findOne({ _id: it.medicine_id, branch_id: branchId });
        if (!medicine) throw new ApiError(404, `Line ${row}: medicine not found in this branch`, 'MEDICINE_NOT_FOUND');

        const quantity = parseInt(it.quantity, 10);
        const freeQty = parseInt(it.free_quantity || 0, 10) || 0;
        if (!quantity || quantity < 1) throw new ApiError(400, `Line ${row} (${medicine.name}): quantity must be at least 1`, 'INVALID_QUANTITY');
        if (freeQty < 0) throw new ApiError(400, `Line ${row}: free quantity cannot be negative`, 'INVALID_QUANTITY');

        const batchNumber = String(it.batch_number || '').trim();
        if (!batchNumber) throw new ApiError(400, `Line ${row} (${medicine.name}): batch number is required`, 'BATCH_NUMBER_REQUIRED');
        const expiry = new Date(it.expiry_date);
        if (!it.expiry_date || isNaN(expiry.getTime()) || expiry <= today) {
            throw new ApiError(400, `Line ${row} (${medicine.name}): expiry date must be in the future`, 'INVALID_EXPIRY_DATE');
        }
        const mfg = it.mfg_date ? new Date(it.mfg_date) : null;

        const purchaseRate = num(it.purchase_rate, NaN);
        const mrp = num(it.mrp, NaN);
        if (isNaN(purchaseRate) || purchaseRate < 0) throw new ApiError(400, `Line ${row} (${medicine.name}): purchase rate is required`, 'INVALID_PRICE');
        if (isNaN(mrp) || mrp < 0) throw new ApiError(400, `Line ${row} (${medicine.name}): MRP is required`, 'INVALID_PRICE');
        if (mrp < purchaseRate) throw new ApiError(400, `Line ${row} (${medicine.name}): MRP cannot be less than purchase rate`, 'INVALID_MRP');
        const salePrice = num(it.sale_price, 0) || medicine.sale_price || mrp;
        if (salePrice > mrp) throw new ApiError(400, `Line ${row} (${medicine.name}): sale price cannot exceed MRP`, 'INVALID_PRICE');
        const gstRate = num(it.gst_rate, medicine.gst_rate || 12);
        const discountPercent = Math.min(100, Math.max(0, num(it.discount_percent, 0)));

        const lineSubtotal = round2(purchaseRate * quantity);
        const discountAmount = round2(lineSubtotal * discountPercent / 100);
        const taxableAmount = round2(lineSubtotal - discountAmount);
        const gstAmount = round2(taxableAmount * gstRate / 100);
        const lineTotal = round2(taxableAmount + gstAmount);

        prepared.push({
            medicine, quantity, freeQty, batchNumber, expiry, mfg, purchaseRate, mrp, salePrice, gstRate, discountPercent,
            rackLocation: String(it.rack_location || '').trim(),
            lineSubtotal, discountAmount, taxableAmount, gstAmount, lineTotal,
        });
    }

    // Bill-level scheme / cash discount: taken off the taxable value before GST,
    // spread over the lines in proportion to their taxable amounts.
    const lineTaxable = round2(prepared.reduce((s, p) => s + p.taxableAmount, 0));
    let billDiscountPercent = Math.min(100, Math.max(0, num(payload.bill_discount_percent, 0)));
    let billDiscountAmount = round2(num(payload.bill_discount_amount, 0));
    if (billDiscountPercent > 0) billDiscountAmount = round2(lineTaxable * billDiscountPercent / 100);
    if (billDiscountAmount < 0 || billDiscountAmount > lineTaxable) {
        throw new ApiError(400, 'Bill discount cannot exceed the taxable amount', 'INVALID_DISCOUNT');
    }
    if (billDiscountAmount > 0 && billDiscountPercent === 0 && lineTaxable > 0) {
        billDiscountPercent = round2(billDiscountAmount / lineTaxable * 100);
    }
    if (billDiscountAmount > 0 && lineTaxable > 0) {
        let left = billDiscountAmount;
        prepared.forEach((p, i) => {
            const share = i === prepared.length - 1 ? left : round2(billDiscountAmount * p.taxableAmount / lineTaxable);
            left = round2(left - share);
            p.discountAmount = round2(p.discountAmount + share);
            p.taxableAmount = round2(p.lineSubtotal - p.discountAmount);
            p.gstAmount = round2(p.taxableAmount * p.gstRate / 100);
            p.lineTotal = round2(p.taxableAmount + p.gstAmount);
        });
    }

    const subtotal = round2(prepared.reduce((s, p) => s + p.lineSubtotal, 0));
    const discountAmount = round2(prepared.reduce((s, p) => s + p.discountAmount, 0));
    const taxableAmount = round2(prepared.reduce((s, p) => s + p.taxableAmount, 0));
    const totalTax = round2(prepared.reduce((s, p) => s + p.gstAmount, 0));
    const grandTotal = round2(taxableAmount + totalTax);
    const amountPaid = Math.min(grandTotal, Math.max(0, num(payload.amount_paid, 0)));

    // Inward stock.
    const purchaseNumber = await nextPurchaseNumber(branchId, invoiceDate);
    const lineDocs = [];
    for (const p of prepared) {
        const received = p.quantity + p.freeQty;
        let batch = await MedicineBatch.findOne({
            branch_id: branchId,
            medicine_id: p.medicine._id,
            batch_number: new RegExp(`^${escapeRegex(p.batchNumber)}$`, 'i'),
        });
        if (batch) {
            batch.current_stock = (batch.current_stock || 0) + received;
            batch.expiry_date = p.expiry;
            if (p.mfg) batch.mfg_date = p.mfg;
            batch.purchase_rate = p.purchaseRate;
            batch.mrp = p.mrp;
            batch.sale_price = p.salePrice;
            batch.gst_rate = p.gstRate;
            batch.is_active = true;
            if (p.rackLocation) batch.rack_location = p.rackLocation;
            await batch.save();
        } else {
            batch = await MedicineBatch.create({
                branch_id: branchId,
                medicine_id: p.medicine._id,
                batch_number: p.batchNumber,
                mfg_date: p.mfg,
                expiry_date: p.expiry,
                purchase_rate: p.purchaseRate,
                mrp: p.mrp,
                sale_price: p.salePrice,
                gst_rate: p.gstRate,
                current_stock: received,
                rack_location: p.rackLocation,
            });
        }

        await StockLog.create({
            branch_id: branchId,
            medicine_id: p.medicine._id,
            batch_id: batch._id,
            type: STOCK_TRANSACTION_TYPES.PURCHASE_IN,
            quantity: received,
            balance_after: batch.current_stock,
            unit_cost: p.purchaseRate,
            reference_type: 'PURCHASE',
            remarks: `${purchaseNumber} · ${supplier.name}${p.freeQty ? ` (${p.freeQty} free)` : ''}`,
            created_by_user_id: userId,
        });

        if (update_prices !== false && update_prices !== 'false') {
            p.medicine.purchase_rate = p.purchaseRate;
            p.medicine.mrp = p.mrp;
            p.medicine.sale_price = p.salePrice;
            p.medicine.gst_rate = p.gstRate;
            await p.medicine.save();
        }

        lineDocs.push({
            medicine_id: p.medicine._id,
            batch_id: batch._id,
            medicine_name: p.medicine.name,
            hsn_code: p.medicine.hsn_code || '',
            batch_number: batch.batch_number,
            expiry_date: p.expiry,
            mfg_date: p.mfg,
            quantity: p.quantity,
            free_quantity: p.freeQty,
            purchase_rate: p.purchaseRate,
            mrp: p.mrp,
            sale_price: p.salePrice,
            gst_rate: p.gstRate,
            discount_percent: p.discountPercent,
            line_subtotal: p.lineSubtotal,
            discount_amount: p.discountAmount,
            taxable_amount: p.taxableAmount,
            gst_amount: p.gstAmount,
            line_total: p.lineTotal,
        });
    }

    const purchase = await Purchase.create({
        branch_id: branchId,
        supplier_id: supplier._id,
        supplier_name: supplier.name,
        purchase_number: purchaseNumber,
        supplier_invoice_number: String(supplier_invoice_number || '').trim(),
        invoice_date: invoiceDate,
        items: lineDocs,
        subtotal,
        discount_amount: discountAmount,
        bill_discount_percent: billDiscountPercent,
        bill_discount_amount: billDiscountAmount,
        taxable_amount: taxableAmount,
        cgst: round2(totalTax / 2),
        sgst: round2(totalTax / 2),
        total_tax: totalTax,
        grand_total: grandTotal,
        amount_paid: amountPaid,
        balance_due: round2(grandTotal - amountPaid),
        payment_status: paymentStatusFor(grandTotal, amountPaid),
        payments: amountPaid > 0
            ? [{ amount: amountPaid, mode: payment_mode === 'CREDIT' ? 'CASH' : payment_mode, note: 'Paid with bill', created_by: userId }]
            : [],
        notes: String(notes || '').trim(),
        created_by: userId,
        created_by_name: user?.fullName || '',
    });

    // Update stock log references now that the purchase id is known.
    await StockLog.updateMany(
        { branch_id: branchId, reference_type: 'PURCHASE', reference_id: null, batch_id: { $in: lineDocs.map((l) => l.batch_id) }, remarks: new RegExp(`^${escapeRegex(purchaseNumber)}`) },
        { $set: { reference_id: purchase._id } }
    );

    emitToBranch(branchId.toString(), 'inventory:stock_updated', {
        source: 'purchase',
        purchase_id: purchase._id.toString(),
        purchase_number: purchaseNumber,
        supplier: supplier.name,
        items: lineDocs.length,
        grand_total: grandTotal,
    });

    return purchase;
};

const getPurchases = async (branchId, query = {}) => {
    const { supplier_id, payment_status, status, search, from, to, page = 1, limit = 25 } = query;
    const filter = { branch_id: branchId };
    if (supplier_id) filter.supplier_id = supplier_id;
    const wanted = String(payment_status || '').toUpperCase();
    if (wanted === 'CANCELLED' || String(status || '').toUpperCase() === 'CANCELLED') {
        filter.status = 'CANCELLED';
    } else if (Purchase.PAYMENT_STATUS.includes(wanted)) {
        filter.payment_status = wanted;
        filter.status = { $ne: 'CANCELLED' };
    }
    if (from || to) {
        filter.invoice_date = {};
        if (from) filter.invoice_date.$gte = new Date(from);
        if (to) {
            const end = new Date(to);
            end.setHours(23, 59, 59, 999);
            filter.invoice_date.$lte = end;
        }
    }
    if (search) {
        const regex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ purchase_number: regex }, { supplier_invoice_number: regex }, { supplier_name: regex }, { 'items.medicine_name': regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const [purchases, total] = await Promise.all([
        Purchase.find(filter).sort({ invoice_date: -1, created_at: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).select('-items.hsn_code'),
        Purchase.countDocuments(filter),
    ]);

    return {
        purchases,
        pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
    };
};

const getPurchaseById = async (branchId, purchaseId) => {
    const purchase = await Purchase.findOne({ _id: purchaseId, branch_id: branchId }).populate('supplier_id', 'name phone gstin address');
    if (!purchase) throw new ApiError(404, 'Purchase not found', 'PURCHASE_NOT_FOUND');
    return purchase;
};

/** Month-to-date purchases, outstanding payables and unpaid bill count. */
const getPurchaseSummary = async (branchId) => {
    const bId = new mongoose.Types.ObjectId(branchId);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [month, due, suppliers] = await Promise.all([
        Purchase.aggregate([
            { $match: { branch_id: bId, invoice_date: { $gte: monthStart }, status: { $ne: 'CANCELLED' } } },
            { $group: { _id: null, total: { $sum: '$grand_total' }, bills: { $sum: 1 } } },
        ]),
        Purchase.aggregate([
            { $match: { branch_id: bId, balance_due: { $gt: 0 }, status: { $ne: 'CANCELLED' } } },
            { $group: { _id: null, outstanding: { $sum: '$balance_due' }, bills: { $sum: 1 } } },
        ]),
        Supplier.countDocuments({ branch_id: branchId, is_active: true }),
    ]);
    return {
        month_total: round2(month[0]?.total || 0),
        month_bills: month[0]?.bills || 0,
        outstanding: round2(due[0]?.outstanding || 0),
        unpaid_bills: due[0]?.bills || 0,
        suppliers,
    };
};

/**
 * Cancels a bill: every line's stock (incl. free goods) is taken back out of
 * its batch — refused when that stock has already been sold — and the bill
 * stops counting towards payables and reports. Payments stay on record.
 */
const cancelPurchase = async (branchId, purchaseId, user, payload = {}) => {
    const purchase = await Purchase.findOne({ _id: purchaseId, branch_id: branchId });
    if (!purchase) throw new ApiError(404, 'Purchase not found', 'PURCHASE_NOT_FOUND');
    if (purchase.status === 'CANCELLED') throw new ApiError(400, 'This purchase is already cancelled', 'ALREADY_CANCELLED');

    // Check all batches first so a cancel is all-or-nothing.
    const batches = [];
    for (const item of purchase.items) {
        const batch = await MedicineBatch.findOne({ _id: item.batch_id, branch_id: branchId });
        const received = item.quantity + (item.free_quantity || 0);
        if (!batch) throw new ApiError(400, `Batch ${item.batch_number} of ${item.medicine_name} no longer exists`, 'BATCH_NOT_FOUND');
        if ((batch.current_stock || 0) < received) {
            throw new ApiError(
                400,
                `${item.medicine_name} (batch ${item.batch_number}): only ${batch.current_stock} left of the ${received} received — stock already sold, cannot cancel. Use a purchase return instead.`,
                'STOCK_ALREADY_USED'
            );
        }
        batches.push({ batch, item, received });
    }

    const userId = user?.userId || user?.id || null;
    for (const { batch, item, received } of batches) {
        batch.current_stock -= received;
        await batch.save();
        await StockLog.create({
            branch_id: branchId,
            medicine_id: item.medicine_id,
            batch_id: batch._id,
            type: STOCK_TRANSACTION_TYPES.ADJUSTMENT,
            quantity: -received,
            balance_after: batch.current_stock,
            unit_cost: item.purchase_rate,
            reference_type: 'PURCHASE_CANCEL',
            reference_id: purchase._id.toString(),
            remarks: `${purchase.purchase_number} cancelled${payload.reason ? `: ${payload.reason}` : ''}`,
            created_by_user_id: userId,
        });
    }

    purchase.status = 'CANCELLED';
    purchase.cancel_reason = String(payload.reason || '').trim();
    purchase.cancelled_at = new Date();
    purchase.cancelled_by_name = user?.fullName || '';
    purchase.balance_due = 0;
    await purchase.save();

    emitToBranch(branchId.toString(), 'inventory:stock_updated', {
        source: 'purchase_cancel',
        purchase_id: purchase._id.toString(),
        purchase_number: purchase.purchase_number,
        items: batches.length,
    });
    return purchase;
};

// ─── Purchase returns (debit notes) ──────────────────────────────────────────

const nextDebitNoteNumber = async (branchId, date) => {
    const d = date ? new Date(date) : new Date();
    const prefix = `DN-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-`;
    const last = await PurchaseReturn.findOne({ branch_id: branchId, debit_note_number: new RegExp(`^${prefix}`) })
        .sort({ debit_note_number: -1 })
        .select('debit_note_number');
    const seq = last ? parseInt(last.debit_note_number.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
};

/**
 * Sends stock back to the supplier. Each line is taken out of its batch
 * (must still be in stock). Value is settled by knocking it off the linked
 * bill's dues (ADJUST_PAYABLE), as a cash refund (REFUND) or left PENDING
 * until the supplier issues a credit note.
 */
const createPurchaseReturn = async (branchId, user, payload) => {
    const userId = user?.userId || user?.id || null;
    const { items, reason, notes, return_date } = payload;
    if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'Add at least one item to return', 'ITEMS_REQUIRED');

    let purchase = null;
    if (payload.purchase_id) {
        purchase = await Purchase.findOne({ _id: payload.purchase_id, branch_id: branchId });
        if (!purchase) throw new ApiError(404, 'Purchase not found', 'PURCHASE_NOT_FOUND');
        if (purchase.status === 'CANCELLED') throw new ApiError(400, 'Cannot return against a cancelled purchase', 'PURCHASE_CANCELLED');
    }
    const supplierId = purchase ? purchase.supplier_id : payload.supplier_id;
    const supplier = await Supplier.findOne({ _id: supplierId, branch_id: branchId });
    if (!supplier) throw new ApiError(404, 'Supplier not found', 'SUPPLIER_NOT_FOUND');

    let settlement = String(payload.settlement || 'PENDING').toUpperCase();
    if (!PurchaseReturn.SETTLEMENTS.includes(settlement)) throw new ApiError(400, 'settlement must be ADJUST_PAYABLE, REFUND or PENDING', 'INVALID_SETTLEMENT');

    // Validate lines against stock before touching anything.
    const prepared = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const batch = await MedicineBatch.findOne({ _id: it.batch_id, branch_id: branchId }).populate('medicine');
        if (!batch) throw new ApiError(404, `Line ${i + 1}: batch not found`, 'BATCH_NOT_FOUND');
        const medicine = batch.medicine || (await Medicine.findOne({ _id: batch.medicine_id, branch_id: branchId }));
        const quantity = parseInt(it.quantity, 10);
        if (!quantity || quantity < 1) throw new ApiError(400, `Line ${i + 1}: quantity must be at least 1`, 'INVALID_QUANTITY');
        if ((batch.current_stock || 0) < quantity) {
            throw new ApiError(400, `${medicine?.name || 'Medicine'} (batch ${batch.batch_number}): only ${batch.current_stock} in stock, cannot return ${quantity}`, 'INSUFFICIENT_STOCK');
        }
        // Rate defaults to what the linked bill (or batch) was bought at.
        const billLine = purchase ? purchase.items.find((l) => l.batch_id.toString() === batch._id.toString()) : null;
        const rate = num(it.purchase_rate, NaN);
        const purchaseRate = isNaN(rate) ? num(billLine?.purchase_rate, batch.purchase_rate || 0) : rate;
        const gstRate = num(it.gst_rate, num(billLine?.gst_rate, batch.gst_rate || 0));
        const taxable = round2(purchaseRate * quantity);
        const gstAmount = round2(taxable * gstRate / 100);
        prepared.push({ batch, medicine, quantity, purchaseRate, gstRate, taxable, gstAmount, lineTotal: round2(taxable + gstAmount) });
    }

    const subtotal = round2(prepared.reduce((s, p) => s + p.taxable, 0));
    const totalTax = round2(prepared.reduce((s, p) => s + p.gstAmount, 0));
    const grandTotal = round2(subtotal + totalTax);
    const returnDate = return_date ? new Date(return_date) : new Date();
    const dnNumber = await nextDebitNoteNumber(branchId, returnDate);

    // Stock out.
    for (const p of prepared) {
        p.batch.current_stock -= p.quantity;
        await p.batch.save();
        await StockLog.create({
            branch_id: branchId,
            medicine_id: p.batch.medicine_id,
            batch_id: p.batch._id,
            type: STOCK_TRANSACTION_TYPES.DAMAGED_EXPIRED_OUT,
            quantity: -p.quantity,
            balance_after: p.batch.current_stock,
            unit_cost: p.purchaseRate,
            reference_type: 'PURCHASE_RETURN',
            remarks: `${dnNumber} · returned to ${supplier.name}${reason ? `: ${reason}` : ''}`,
            created_by_user_id: userId,
        });
    }

    // Settle against the linked bill's dues where possible.
    let adjusted = 0;
    if (settlement === 'ADJUST_PAYABLE') {
        if (purchase && purchase.balance_due > 0) {
            adjusted = round2(Math.min(grandTotal, purchase.balance_due));
            purchase.payments.push({ amount: adjusted, mode: 'DEBIT_NOTE', reference: dnNumber, note: 'Purchase return adjusted', paid_at: returnDate, created_by: userId });
            purchase.amount_paid = round2(purchase.amount_paid + adjusted);
            purchase.balance_due = round2(Math.max(0, purchase.grand_total - purchase.amount_paid));
            purchase.payment_status = paymentStatusFor(purchase.grand_total, purchase.amount_paid);
            await purchase.save();
        }
        if (adjusted < grandTotal) settlement = adjusted > 0 ? 'ADJUST_PAYABLE' : 'PENDING';
    }

    const ret = await PurchaseReturn.create({
        branch_id: branchId,
        supplier_id: supplier._id,
        supplier_name: supplier.name,
        purchase_id: purchase ? purchase._id : null,
        purchase_number: purchase ? purchase.purchase_number : '',
        debit_note_number: dnNumber,
        return_date: returnDate,
        reason: String(reason || '').trim(),
        items: prepared.map((p) => ({
            medicine_id: p.batch.medicine_id,
            batch_id: p.batch._id,
            medicine_name: p.medicine?.name || '',
            batch_number: p.batch.batch_number,
            expiry_date: p.batch.expiry_date,
            quantity: p.quantity,
            purchase_rate: p.purchaseRate,
            gst_rate: p.gstRate,
            taxable_amount: p.taxable,
            gst_amount: p.gstAmount,
            line_total: p.lineTotal,
        })),
        subtotal,
        total_tax: totalTax,
        grand_total: grandTotal,
        settlement,
        adjusted_amount: adjusted,
        notes: String(notes || '').trim(),
        created_by: userId,
        created_by_name: user?.fullName || '',
    });
    await StockLog.updateMany(
        { branch_id: branchId, reference_type: 'PURCHASE_RETURN', reference_id: null, remarks: new RegExp(`^${escapeRegex(dnNumber)}`) },
        { $set: { reference_id: ret._id.toString() } }
    );

    emitToBranch(branchId.toString(), 'inventory:stock_updated', {
        source: 'purchase_return',
        return_id: ret._id.toString(),
        debit_note_number: dnNumber,
        supplier: supplier.name,
        items: prepared.length,
        grand_total: grandTotal,
    });
    return ret;
};

const getPurchaseReturns = async (branchId, query = {}) => {
    const { supplier_id, purchase_id, search, page = 1, limit = 25 } = query;
    const filter = { branch_id: branchId };
    if (supplier_id) filter.supplier_id = supplier_id;
    if (purchase_id) filter.purchase_id = purchase_id;
    if (search) {
        const regex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [{ debit_note_number: regex }, { purchase_number: regex }, { supplier_name: regex }, { 'items.medicine_name': regex }];
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const [returns, total] = await Promise.all([
        PurchaseReturn.find(filter).sort({ return_date: -1, created_at: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
        PurchaseReturn.countDocuments(filter),
    ]);
    return { returns, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 } };
};

const getPurchaseReturnById = async (branchId, id) => {
    const ret = await PurchaseReturn.findOne({ _id: id, branch_id: branchId });
    if (!ret) throw new ApiError(404, 'Debit note not found', 'RETURN_NOT_FOUND');
    return ret;
};

const addPurchasePayment = async (branchId, purchaseId, user, payload) => {
    const purchase = await Purchase.findOne({ _id: purchaseId, branch_id: branchId });
    if (!purchase) throw new ApiError(404, 'Purchase not found', 'PURCHASE_NOT_FOUND');
    if (purchase.status === 'CANCELLED') throw new ApiError(400, 'Cannot record a payment on a cancelled purchase', 'PURCHASE_CANCELLED');

    const amount = round2(num(payload.amount, 0));
    if (amount <= 0) throw new ApiError(400, 'Payment amount must be greater than 0', 'INVALID_AMOUNT');
    if (amount > purchase.balance_due + 0.005) {
        throw new ApiError(400, `Amount exceeds balance due (${purchase.balance_due})`, 'AMOUNT_EXCEEDS_DUE');
    }
    const mode = String(payload.mode || payload.payment_mode || 'CASH').toUpperCase();
    if (!Purchase.CASH_MODES.includes(mode)) {
        throw new ApiError(400, 'mode must be CASH, UPI, BANK or CHEQUE', 'INVALID_PAYMENT_MODE');
    }

    purchase.payments.push({
        amount,
        mode,
        reference: String(payload.reference || '').trim(),
        note: String(payload.note || '').trim(),
        paid_at: payload.paid_at ? new Date(payload.paid_at) : new Date(),
        created_by: user?.userId || user?.id || null,
    });
    purchase.amount_paid = round2(purchase.amount_paid + amount);
    purchase.balance_due = round2(Math.max(0, purchase.grand_total - purchase.amount_paid));
    purchase.payment_status = paymentStatusFor(purchase.grand_total, purchase.amount_paid);
    await purchase.save();
    return purchase;
};

module.exports = {
    createSupplier,
    updateSupplier,
    getSuppliers,
    getSupplierById,
    getSupplierLedger,
    paySupplier,
    createPurchase,
    getPurchases,
    getPurchaseById,
    getPurchaseSummary,
    addPurchasePayment,
    cancelPurchase,
    createPurchaseReturn,
    getPurchaseReturns,
    getPurchaseReturnById,
};
