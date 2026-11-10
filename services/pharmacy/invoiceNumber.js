const { Branch, Invoice } = require('../../models/pharmacy');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `INV-<branch code>-<YYYYMMDD>-` for today (UTC date, as before). */
const invoicePrefix = async (branchId) => {
    const branch = await Branch.findById(branchId).select('code');
    const branchCode = branch ? branch.code : 'MC';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${branchCode}-${dateStr}-`;
};

/**
 * Next free invoice number for the branch today: a running 4-digit counter
 * (0001, 0002 …) that skips numbers already taken. Replaces the old random
 * 4-digit suffix, which collided often enough to fail sales.
 */
const nextInvoiceNumber = async (branchId) => {
    const prefix = await invoicePrefix(branchId);
    let seq = (await Invoice.countDocuments({ invoice_number: new RegExp(`^${escapeRegex(prefix)}`) })) + 1;
    for (;;) {
        const number = `${prefix}${String(seq).padStart(4, '0')}`;
        if (!(await Invoice.exists({ invoice_number: number }))) return number;
        seq += 1;
    }
};

/**
 * Creates an invoice with a fresh number, retrying when two bills race for
 * the same number (unique index on invoice_number).
 */
const createWithInvoiceNumber = async (branchId, buildDoc, attempts = 5) => {
    for (let i = 0; i < attempts; i++) {
        const number = await nextInvoiceNumber(branchId);
        try {
            return await Invoice.create(buildDoc(number));
        } catch (err) {
            const duplicateNumber = err && err.code === 11000 && err.keyPattern && err.keyPattern.invoice_number;
            if (!duplicateNumber || i === attempts - 1) throw err;
        }
    }
    return null;
};

module.exports = { invoicePrefix, nextInvoiceNumber, createWithInvoiceNumber };
