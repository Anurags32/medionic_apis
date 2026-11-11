const { Customer, Invoice, Order } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');


const createCustomer = async (branchId, payload) => {
    const { name, phone, email, address, city, pincode } = payload;
    const openingBalance = parseMoney(payload.opening_balance) ?? 0;
    if (openingBalance < 0) {
        throw new ApiError(400, 'Opening khata balance cannot be negative', 'INVALID_OPENING_BALANCE');
    }

    const existing = await Customer.findOne({
        branch_id: branchId,
        phone: phone.trim(),
    });

    if (existing) {
        return existing;
    }

    const customer = await Customer.create({
        branch_id: branchId,
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim().toLowerCase() : null,
        address: address || '',
        city: city || '',
        pincode: pincode || '',
        khata_balance: openingBalance,
        opening_balance: openingBalance,
    });

    return customer;
};

// ─── Bulk import (Excel / CSV → customers with opening khata) ────────────────

const CUSTOMER_IMPORT_MAX_ROWS = 2000;

// Header aliases accepted in uploaded sheets (Marg / Tally / Excel / registers).
const CUSTOMER_IMPORT_ALIASES = {
    name: ['name', 'customer', 'customer_name', 'party', 'party_name', 'patient', 'patient_name', 'account', 'account_name'],
    phone: ['phone', 'mobile', 'mobile_no', 'mobile_number', 'phone_no', 'phone_number', 'contact', 'contact_no', 'whatsapp'],
    email: ['email', 'email_id', 'mail'],
    address: ['address', 'addr', 'address_1', 'locality'],
    city: ['city', 'town', 'place'],
    pincode: ['pincode', 'pin', 'pin_code', 'zip', 'postal_code'],
    opening_balance: ['opening_balance', 'opening', 'balance', 'khata', 'khata_balance', 'udhaar', 'udhar', 'due', 'dues',
        'outstanding', 'closing_balance', 'amount_due', 'credit', 'baki', 'baaki'],
};

const normaliseImportHeader = (h) => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const normaliseCustomerRow = (raw) => {
    const out = {};
    for (const [key, value] of Object.entries(raw || {})) {
        const header = normaliseImportHeader(key);
        if (!header) continue;
        const field = Object.keys(CUSTOMER_IMPORT_ALIASES).find((f) => CUSTOMER_IMPORT_ALIASES[f].includes(header)) || header;
        if (out[field] === undefined || out[field] === '') out[field] = typeof value === 'string' ? value.trim() : value;
    }
    return out;
};

/** "₹1,240.50" / "1240" / "" → number (undefined when blank or unreadable). */
function parseMoney(v) {
    if (v === undefined || v === null || v === '') return undefined;
    const n = parseFloat(String(v).replace(/[₹,\s]/g, '').replace(/^rs\.?/i, ''));
    return Number.isNaN(n) ? undefined : Math.round(n * 100) / 100;
}

/** Indian mobile → 10 digits ("+91 98765-43210", "098765 43210" → "9876543210"); null if unusable. */
const normaliseIndianPhone = (v) => {
    let digits = String(v ?? '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits) ? digits : null;
};

/**
 * Imports customers with their old udhaar as opening khata balance. A phone
 * that already exists is skipped, except that a customer with no khata yet
 * gets the opening balance from the sheet. Returns per-row results.
 */
const importCustomers = async (branchId, rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new ApiError(400, 'rows must be a non-empty array', 'ROWS_REQUIRED');
    }
    if (rows.length > CUSTOMER_IMPORT_MAX_ROWS) {
        throw new ApiError(400, `Import at most ${CUSTOMER_IMPORT_MAX_ROWS} rows per request`, 'TOO_MANY_ROWS');
    }

    const summary = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0, opening_khata_total: 0, errors: [] };
    const seenInSheet = new Set();

    for (let i = 0; i < rows.length; i++) {
        const r = normaliseCustomerRow(rows[i]);
        const rowNo = i + 2; // sheet row (1 = header)
        const name = String(r.name || '').trim();
        const fail = (message) => {
            summary.failed++;
            summary.errors.push({ row: rowNo, name, message });
        };

        if (!name) {
            summary.skipped++;
            summary.errors.push({ row: rowNo, name: '', message: 'Blank name' });
            continue;
        }
        const phone = normaliseIndianPhone(r.phone);
        if (!phone) {
            fail(r.phone ? `Phone "${r.phone}" is not a valid 10-digit mobile number` : 'Phone number missing');
            continue;
        }
        const balance = parseMoney(r.opening_balance);
        if (r.opening_balance !== undefined && r.opening_balance !== '' && balance === undefined) {
            fail(`Opening balance "${r.opening_balance}" is not a number`);
            continue;
        }
        if (balance !== undefined && balance < 0) {
            fail('Negative balance (advance) is not supported — enter dues only');
            continue;
        }
        if (seenInSheet.has(phone)) {
            summary.skipped++;
            summary.errors.push({ row: rowNo, name, message: `Phone ${phone} appears twice in the sheet` });
            continue;
        }
        seenInSheet.add(phone);

        try {
            const existing = await Customer.findOne({ branch_id: branchId, phone });
            if (existing) {
                if (balance > 0 && !(existing.khata_balance > 0) && !(existing.opening_balance > 0)) {
                    existing.khata_balance = balance;
                    existing.opening_balance = balance;
                    await existing.save();
                    summary.updated++;
                    summary.opening_khata_total = Math.round((summary.opening_khata_total + balance) * 100) / 100;
                } else {
                    summary.skipped++;
                    summary.errors.push({
                        row: rowNo,
                        name,
                        message: existing.khata_balance > 0
                            ? `Already a customer with khata ${existing.khata_balance} — not changed`
                            : 'Already a customer — not changed',
                    });
                }
                continue;
            }

            await Customer.create({
                branch_id: branchId,
                name,
                phone,
                email: r.email ? String(r.email).trim().toLowerCase() : null,
                address: r.address || '',
                city: r.city || '',
                pincode: r.pincode ? String(r.pincode) : '',
                khata_balance: balance || 0,
                opening_balance: balance || 0,
            });
            summary.created++;
            summary.opening_khata_total = Math.round((summary.opening_khata_total + (balance || 0)) * 100) / 100;
        } catch (err) {
            fail(err.message || 'Import failed');
        }
    }

    return summary;
};

/** CSV template (headers + 2 sample rows) for the customer import dialog. */
const customerImportTemplateCsv = () => [
    'name,phone,opening_balance,address,city,pincode,email',
    'Rahul Verma,9876543210,1240,12 MG Road,Lucknow,226001,',
    'Sunita Devi,9123456780,0,,Lucknow,,',
].join('\n');

const getCustomers = async (branchId, query = {}) => {
    const { search, page = 1, limit = 50 } = query;
    const filter = { branch_id: branchId, is_active: true };

    if (search) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [
            { name: regex },
            { phone: regex },
            { email: regex },
        ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [customers, total] = await Promise.all([
        Customer.find(filter)
            .sort({ name: 1 })
            .skip(skip)
            .limit(limitNum),
        Customer.countDocuments(filter),
    ]);

    return {
        customers,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
    };
};

const getCustomerById = async (branchId, customerId) => {
    const customer = await Customer.findOne({
        _id: customerId,
        branch_id: branchId,
    });

    if (!customer) {
        throw new ApiError(404, 'Customer not found in this branch', 'CUSTOMER_NOT_FOUND');
    }

    const [invoices, orders] = await Promise.all([
        Invoice.find({ customer_id: customer._id, branch_id: branchId })
            .sort({ invoice_date: -1 })
            .limit(10),
        Order.find({ customer_id: customer._id, branch_id: branchId })
            .sort({ created_at: -1 })
            .limit(10),
    ]);

    const result = customer.toJSON();
    result.invoices = invoices;
    result.orders = orders;

    return result;
};

const settleKhataPayment = async (branchId, customerId, amount, paymentMode, notes) => {
    const customer = await Customer.findOne({
        _id: customerId,
        branch_id: branchId,
    });

    if (!customer) {
        throw new ApiError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');
    }

    const payAmount = parseFloat(amount);
    const newBalance = Math.max(0, (customer.khata_balance || 0) - payAmount);
    customer.khata_balance = newBalance;
    await customer.save();

    return {
        customer_id: customer._id.toString(),
        name: customer.name,
        amount_settled: payAmount,
        remaining_khata_balance: newBalance,
        payment_mode: paymentMode,
        notes: notes || 'Khata Settlement',
    };
};

const getCustomerLedger = async (branchId, customerId) => {
    const customer = await Customer.findOne({
        _id: customerId,
        branch_id: branchId,
    });

    if (!customer) {
        throw new ApiError(404, 'Customer not found in this branch', 'CUSTOMER_NOT_FOUND');
    }

    const invoices = await Invoice.find({ customer_id: customer._id, branch_id: branchId })
        .sort({ invoice_date: -1 });

    const opening = customer.opening_balance > 0
        ? [{
            id: `opening-${customer._id}`,
            invoice_number: 'Opening balance',
            date: customer.created_at,
            total_amount: customer.opening_balance,
            amount_paid: 0,
            balance_due: customer.opening_balance,
            payment_mode: 'KHATA',
            payment_status: 'PENDING',
            is_opening_balance: true,
        }]
        : [];

    return {
        customer_id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        khata_balance: customer.khata_balance || 0,
        opening_balance: customer.opening_balance || 0,
        ledger: [...invoices.map(inv => ({
            id: inv._id.toString(),
            invoice_number: inv.invoice_number,
            date: inv.invoice_date,
            total_amount: inv.grand_total,
            amount_paid: inv.amount_paid,
            balance_due: inv.balance_due,
            payment_mode: inv.payment_mode,
            payment_status: inv.payment_status,
        })), ...opening],
    };
};

module.exports = {
    importCustomers,
    customerImportTemplateCsv,
    normaliseIndianPhone,
    createCustomer,
    getCustomers,
    getCustomerById,
    settleKhataPayment,
    getCustomerLedger,
};
