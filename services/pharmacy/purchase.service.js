const mongoose = require('mongoose');
const { Medicine, MedicineBatch, StockLog, Supplier, Purchase } = require('../../models/pharmacy');
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
    const match = { branch_id: new mongoose.Types.ObjectId(branchId), balance_due: { $gt: 0 } };
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
        { $match: { branch_id: new mongoose.Types.ObjectId(branchId), supplier_id: supplier._id } },
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
    const { supplier_id, payment_status, search, from, to, page = 1, limit = 25 } = query;
    const filter = { branch_id: branchId };
    if (supplier_id) filter.supplier_id = supplier_id;
    if (payment_status && Purchase.PAYMENT_STATUS.includes(String(payment_status).toUpperCase())) {
        filter.payment_status = String(payment_status).toUpperCase();
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
            { $match: { branch_id: bId, invoice_date: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: '$grand_total' }, bills: { $sum: 1 } } },
        ]),
        Purchase.aggregate([
            { $match: { branch_id: bId, balance_due: { $gt: 0 } } },
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

const addPurchasePayment = async (branchId, purchaseId, user, payload) => {
    const purchase = await Purchase.findOne({ _id: purchaseId, branch_id: branchId });
    if (!purchase) throw new ApiError(404, 'Purchase not found', 'PURCHASE_NOT_FOUND');

    const amount = round2(num(payload.amount, 0));
    if (amount <= 0) throw new ApiError(400, 'Payment amount must be greater than 0', 'INVALID_AMOUNT');
    if (amount > purchase.balance_due + 0.005) {
        throw new ApiError(400, `Amount exceeds balance due (${purchase.balance_due})`, 'AMOUNT_EXCEEDS_DUE');
    }
    const mode = String(payload.mode || payload.payment_mode || 'CASH').toUpperCase();
    if (!Purchase.PAYMENT_MODES.includes(mode) || mode === 'CREDIT') {
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
    createPurchase,
    getPurchases,
    getPurchaseById,
    getPurchaseSummary,
    addPurchasePayment,
};
