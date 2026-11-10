// POS billing and khata: invoice maths, stock deduction, payment status,
// customer khata, invoice numbering, invoice returns.
const { Invoice, Customer, MedicineBatch, Medicine, StockLog } = require('../../models/pharmacy');
const pos = require('../../services/pharmacy/pos.service');
const customers = require('../../services/pharmacy/customer.service');
const { inDays, makeStore, expectApiError } = require('./helpers');

const item = (store, over = {}) => ({
    medicine_id: store.medicine._id.toString(),
    batch_id: store.batch._id.toString(),
    quantity: 2,
    ...over,
});
const stockOf = async (id) => (await MedicineBatch.findById(id)).current_stock;
const lastInvoice = (branchId) => Invoice.findOne({ branch_id: branchId }).sort({ created_at: -1, _id: -1 });

const addOrs = async (store, stock = 1) => {
    const med = await Medicine.create({ branch_id: store.branch._id, category_id: store.category._id, name: 'ORS', mrp: 20, sale_price: 20, gst_rate: 5 });
    const batch = await MedicineBatch.create({
        branch_id: store.branch._id, medicine_id: med._id, batch_number: 'ORS1', expiry_date: inDays(300), purchase_rate: 10, mrp: 20, sale_price: 20, gst_rate: 5, current_stock: stock,
    });
    return { med, batch };
};

describe('createInvoice', () => {
    test('line maths: sale price × qty, discount, GST on top, CGST/SGST split; stock and log', async () => {
        const store = await makeStore();
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store, { discount_percent: 10 })] });
        const inv = await lastInvoice(store.branch._id);
        // 2 x 110 = 220, 10% = 22, taxable 198, GST 12% = 23.76
        expect(inv.subtotal).toBe(220);
        expect(inv.discount_amount).toBe(22);
        expect(inv.total_tax).toBe(23.76);
        expect(inv.cgst_amount).toBe(11.88);
        expect(inv.sgst_amount).toBe(11.88);
        expect(inv.grand_total).toBe(221.76);
        expect(inv.payment_status).toBe('PAID');
        expect(inv.amount_paid).toBe(221.76);
        expect(inv.balance_due).toBe(0);

        expect(await stockOf(store.batch._id)).toBe(77);
        const log = await StockLog.findOne({ batch_id: store.batch._id, type: 'SALE_OUT' });
        expect(log.quantity).toBe(-2);
        expect(log.balance_after).toBe(77);
        expect(log.reference_type).toBe('INVOICE');
        expect(log.reference_id).toBe(String(inv._id));
    });

    test('without GST: no CGST/SGST, total = taxable value, marked as bill of supply', async () => {
        const store = await makeStore();
        const receipt = await pos.createInvoice(store.branch._id, store.user.userId, {
            items: [item(store, { discount_percent: 10 })], apply_gst: false,
        });
        const inv = await lastInvoice(store.branch._id);
        expect(inv.gst_applied).toBe(false);
        expect(inv.subtotal).toBe(220);
        expect(inv.total_tax).toBe(0);
        expect(inv.cgst_amount).toBe(0);
        expect(inv.sgst_amount).toBe(0);
        expect(inv.grand_total).toBe(198);
        expect(inv.items[0].gst_rate).toBe(0);
        expect(inv.items[0].gst_amount).toBe(0);
        const summary = JSON.parse(JSON.stringify(receipt)).bill_summary;
        expect(summary.gst_applied).toBe(false);
        expect(summary.grand_total).toBe(198);
    });

    test('GST is applied by default (and with apply_gst: true)', async () => {
        const store = await makeStore();
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)] });
        expect((await lastInvoice(store.branch._id)).gst_applied).toBe(true);
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)], apply_gst: true });
        const inv = await lastInvoice(store.branch._id);
        expect(inv.gst_applied).toBe(true);
        expect(inv.total_tax).toBe(26.4);
    });

    test('return on a no-GST bill refunds the billed price without tax', async () => {
        const store = await makeStore();
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store, { discount_percent: 10 })], apply_gst: false });
        const inv = await lastInvoice(store.branch._id);
        const r = await pos.returnInvoiceItems(store.branch._id, store.user.userId, inv._id, [{ medicine_id: store.medicine._id, quantity: 1 }]);
        expect(r.refund_amount).toBe(99);
    });

    test('bill keeps what was printed: medicine, batch, expiry, discount %, patient, doctor, notes', async () => {
        const store = await makeStore();
        const receipt = await pos.createInvoice(store.branch._id, store.user.userId, {
            items: [item(store, { discount_percent: 10 })], patient_name: 'Rahul', doctor_name: 'Dr. Rao', notes: 'After food',
        });
        const inv = await lastInvoice(store.branch._id);
        expect(inv.patient_name).toBe('Rahul');
        expect(inv.doctor_name).toBe('Dr. Rao');
        expect(inv.notes).toBe('After food');
        const line = inv.items[0];
        expect(line.medicine_name).toBe('Ascoril LS Syrup');
        expect(line.batch_number).toBe('ASC-LS-09');
        expect(line.expiry_date).toBeInstanceOf(Date);
        expect(line.hsn_code).toBe('3004');
        expect(line.discount_percent).toBe(10);
        // The receipt API reads these fields straight back.
        const r = JSON.parse(JSON.stringify(receipt));
        expect(JSON.stringify(r)).toContain('Ascoril LS Syrup');
        expect(JSON.stringify(r)).toContain('Rahul');
    });

    test('KHATA bill auto-creates the customer by phone and adds to khata', async () => {
        const store = await makeStore();
        await pos.createInvoice(store.branch._id, store.user.userId, {
            items: [item(store)], payment_mode: 'KHATA', patient_name: 'Rahul', customer_phone: '9876543210',
        });
        const inv = await lastInvoice(store.branch._id);
        expect(inv.payment_status).toBe('PENDING');
        expect(inv.amount_paid).toBe(0);
        expect(inv.balance_due).toBe(246.4);
        const c = await Customer.findOne({ branch_id: store.branch._id, phone: '9876543210' });
        expect(c.name).toBe('Rahul');
        expect(c.khata_balance).toBe(246.4);
        expect(String(inv.customer_id)).toBe(String(c._id));
    });

    test('partial payment is PARTIALLY_PAID and the rest goes to the same customer\'s khata', async () => {
        const store = await makeStore();
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)], payment_mode: 'KHATA', patient_name: 'Rahul', customer_phone: '9000000001' });
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)], payment_mode: 'CASH', amount_paid: 100, patient_name: 'Rahul', customer_phone: '9000000001' });
        const inv = await lastInvoice(store.branch._id);
        expect(inv.payment_status).toBe('PARTIALLY_PAID');
        expect(inv.amount_paid).toBe(100);
        expect(inv.balance_due).toBe(146.4);
        expect(await Customer.countDocuments({ branch_id: store.branch._id, phone: '9000000001' })).toBe(1);
        expect((await Customer.findOne({ phone: '9000000001', branch_id: store.branch._id })).khata_balance).toBeCloseTo(392.8, 2);
    });

    test('cash beyond the bill is change: amount paid is capped at the total', async () => {
        const store = await makeStore();
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)], amount_paid: 500 });
        const inv = await lastInvoice(store.branch._id);
        expect(inv.amount_paid).toBe(246.4);
        expect(inv.balance_due).toBe(0);
        expect(inv.payment_status).toBe('PAID');
    });

    test('guards: no items, bad quantity, other branch batch, insufficient stock, bad amount', async () => {
        const a = await makeStore();
        const b = await makeStore();
        await expectApiError(pos.createInvoice(a.branch._id, a.user.userId, { items: [] }), 'ITEMS_REQUIRED', 400);
        await expectApiError(pos.createInvoice(a.branch._id, a.user.userId, { items: [item(a, { quantity: 0 })] }), 'INVALID_QUANTITY', 400);
        await expectApiError(pos.createInvoice(a.branch._id, a.user.userId, { items: [item(a, { quantity: 1.5 })] }), 'INVALID_QUANTITY', 400);
        await expectApiError(pos.createInvoice(a.branch._id, a.user.userId, { items: [item(b)] }), 'BATCH_NOT_FOUND', 404);
        await expectApiError(pos.createInvoice(a.branch._id, a.user.userId, { items: [item(a, { quantity: 500 })] }), 'INSUFFICIENT_STOCK', 400);
        await expectApiError(pos.createInvoice(a.branch._id, a.user.userId, { items: [item(a)], amount_paid: -5 }), 'INVALID_AMOUNT', 400);
        expect(await stockOf(a.batch._id)).toBe(79);
    });

    test('a failing later line does not deduct stock of earlier lines', async () => {
        const store = await makeStore();
        const ors = await addOrs(store, 1);
        await expectApiError(
            pos.createInvoice(store.branch._id, store.user.userId, {
                items: [item(store), { medicine_id: ors.med._id.toString(), batch_id: ors.batch._id.toString(), quantity: 5 }],
            }),
            'INSUFFICIENT_STOCK'
        );
        expect(await stockOf(store.batch._id)).toBe(79);
        expect(await stockOf(ors.batch._id)).toBe(1);
        expect(await Invoice.countDocuments({ branch_id: store.branch._id })).toBe(0);
    });

    test('the same batch on two lines is checked against total quantity', async () => {
        const store = await makeStore({ stock: 3 });
        await expectApiError(
            pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store), item(store)] }),
            'INSUFFICIENT_STOCK'
        );
        expect(await stockOf(store.batch._id)).toBe(3);
    });

    test('stock is put back when the invoice cannot be saved', async () => {
        const store = await makeStore();
        const spy = jest.spyOn(Invoice, 'create').mockRejectedValueOnce(new Error('db down'));
        try {
            await expect(pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)] })).rejects.toThrow('db down');
        } finally {
            spy.mockRestore();
        }
        expect(await stockOf(store.batch._id)).toBe(79);
        expect(await StockLog.countDocuments({ batch_id: store.batch._id, type: 'SALE_OUT' })).toBe(0);
    });

    test('invoice numbers run in sequence per store per day and never collide', async () => {
        const store = await makeStore();
        const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5); // old code: same suffix every time
        try {
            for (let i = 0; i < 3; i++) {
                await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store, { quantity: 1 })] });
            }
        } finally {
            spy.mockRestore();
        }
        const numbers = (await Invoice.find({ branch_id: store.branch._id }).sort({ _id: 1 })).map((i) => i.invoice_number);
        expect(numbers).toHaveLength(3);
        expect(new Set(numbers).size).toBe(3);
        expect(numbers.map((n) => n.slice(-4))).toEqual(['0001', '0002', '0003']);
        expect(numbers[0]).toMatch(new RegExp(`^INV-${store.branch.code}-\\d{8}-0001$`));
    });

    test('a taken number is skipped', async () => {
        const store = await makeStore();
        const first = await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store, { quantity: 1 })] });
        const inv = await lastInvoice(store.branch._id);
        // Someone already holds what would be the next number.
        await Invoice.create({ branch_id: store.branch._id, invoice_number: inv.invoice_number.replace(/0001$/, '0002'), grand_total: 1 });
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store, { quantity: 1 })] });
        const last = await lastInvoice(store.branch._id);
        expect(last.invoice_number.slice(-4)).toBe('0003');
        expect(first).toBeTruthy();
    });

    test('credit (KHATA or partial) needs a customer or phone', async () => {
        const store = await makeStore();
        await expectApiError(
            pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)], payment_mode: 'KHATA' }),
            'CUSTOMER_REQUIRED_FOR_CREDIT',
            400
        );
        await expectApiError(
            pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store)], payment_mode: 'CASH', amount_paid: 50 }),
            'CUSTOMER_REQUIRED_FOR_CREDIT',
            400
        );
        expect(await stockOf(store.batch._id)).toBe(79);
        expect(await Invoice.countDocuments({ branch_id: store.branch._id })).toBe(0);
    });

    test('a failed bill does not create a customer', async () => {
        const store = await makeStore();
        await expectApiError(
            pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store, { quantity: 999 })], customer_phone: '9222222222' }),
            'INSUFFICIENT_STOCK'
        );
        expect(await Customer.countDocuments({ branch_id: store.branch._id, phone: '9222222222' })).toBe(0);
    });
});

describe('settleKhataPayment', () => {
    test('reduces the khata balance and never goes below zero', async () => {
        const store = await makeStore();
        const c = await Customer.create({ branch_id: store.branch._id, name: 'Rahul', phone: '9111111111', khata_balance: 500 });
        const r1 = await customers.settleKhataPayment(store.branch._id, c._id, 200, 'UPI');
        expect(r1.remaining_khata_balance).toBe(300);
        const r2 = await customers.settleKhataPayment(store.branch._id, c._id, 1000, 'CASH');
        expect(r2.remaining_khata_balance).toBe(0);
        await expectApiError(customers.settleKhataPayment(store.branch._id, store.batch._id, 10, 'CASH'), 'CUSTOMER_NOT_FOUND', 404);
    });
});

describe('returnInvoiceItems', () => {
    const sell = async (store, over = {}) => {
        await pos.createInvoice(store.branch._id, store.user.userId, { items: [item(store, { discount_percent: 10, ...over })] });
        return lastInvoice(store.branch._id);
    };
    const ret = (store, inv, items) => pos.returnInvoiceItems(store.branch._id, store.user.userId, inv._id, items);

    test('returned units go back into the sold batch with a RETURN_IN log', async () => {
        const store = await makeStore();
        const inv = await sell(store);
        const r = await ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 1, reason: 'Wrong strength' }]);
        expect(await stockOf(store.batch._id)).toBe(78);
        const log = await StockLog.findOne({ batch_id: store.batch._id, type: 'RETURN_IN' });
        expect(log.reference_id).toBe(String(inv._id));
        expect(r.returned_items[0].medicine_name).toBe('Ascoril LS Syrup');
        expect(r.returned_items[0].reason).toBe('Wrong strength');
    });

    test('refund is the billed price per unit (after discount, incl. GST)', async () => {
        const store = await makeStore();
        const inv = await sell(store); // 110, 10% off, 12% GST -> 110.88 per unit
        const r = await ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 1 }]);
        expect(r.refund_amount).toBe(110.88);
        expect((await Invoice.findById(inv._id)).refunded_amount).toBe(110.88);
    });

    test('cannot return more than was sold, including earlier returns', async () => {
        const store = await makeStore();
        const inv = await sell(store); // sold 2
        await expectApiError(ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 50 }]), 'RETURN_EXCEEDS_SOLD', 400);
        expect(await stockOf(store.batch._id)).toBe(77);

        await ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 1 }]);
        await ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 1 }]);
        await expectApiError(ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 1 }]), 'RETURN_EXCEEDS_SOLD', 400);
        expect(await stockOf(store.batch._id)).toBe(79);
        expect((await Invoice.findById(inv._id)).items[0].returned_quantity).toBe(2);
    });

    test('cannot return a medicine that is not on the invoice', async () => {
        const store = await makeStore();
        const inv = await sell(store);
        const other = await Medicine.create({ branch_id: store.branch._id, category_id: store.category._id, name: 'Not sold', mrp: 500, sale_price: 500 });
        await expectApiError(ret(store, inv, [{ medicine_id: other._id, quantity: 1 }]), 'ITEM_NOT_ON_INVOICE', 400);
    });

    test('stock goes back to the batch that was sold, not the newest one', async () => {
        const store = await makeStore();
        const inv = await sell(store);
        const later = await MedicineBatch.create({
            branch_id: store.branch._id, medicine_id: store.medicine._id, batch_number: 'LATER', expiry_date: inDays(900), purchase_rate: 70, mrp: 120, sale_price: 110, current_stock: 0,
        });
        await ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 1 }]);
        expect(await stockOf(store.batch._id)).toBe(78);
        expect(await stockOf(later._id)).toBe(0);
    });

    test('zero-quantity lines are skipped; an all-zero or invalid return is refused', async () => {
        const store = await makeStore();
        const ors = await addOrs(store, 5);
        await pos.createInvoice(store.branch._id, store.user.userId, {
            items: [item(store), { medicine_id: ors.med._id.toString(), batch_id: ors.batch._id.toString(), quantity: 2 }],
        });
        const inv = await lastInvoice(store.branch._id);
        const r = await ret(store, inv, [
            { medicine_id: store.medicine._id, quantity: 0 },
            { medicine_id: ors.med._id, quantity: 1 },
        ]);
        expect(r.returned_items).toHaveLength(1);
        expect(await stockOf(store.batch._id)).toBe(77);
        expect(await stockOf(ors.batch._id)).toBe(4);
        await expectApiError(ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 0 }]), 'ITEMS_REQUIRED', 400);
        await expectApiError(ret(store, inv, [{ medicine_id: store.medicine._id, quantity: -1 }]), 'INVALID_QUANTITY', 400);
    });

    test('a return that fails on one line changes nothing', async () => {
        const store = await makeStore();
        const ors = await addOrs(store, 5);
        await pos.createInvoice(store.branch._id, store.user.userId, {
            items: [item(store), { medicine_id: ors.med._id.toString(), batch_id: ors.batch._id.toString(), quantity: 1 }],
        });
        const inv = await lastInvoice(store.branch._id);
        await expectApiError(
            ret(store, inv, [{ medicine_id: store.medicine._id, quantity: 1 }, { medicine_id: ors.med._id, quantity: 3 }]),
            'RETURN_EXCEEDS_SOLD'
        );
        expect(await stockOf(store.batch._id)).toBe(77);
        expect((await Invoice.findById(inv._id)).items[0].returned_quantity).toBe(0);
    });
});
