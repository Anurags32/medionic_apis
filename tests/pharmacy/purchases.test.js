// Purchase module: suppliers, bills (stock inward + totals), payments, cancel,
// supplier ledger, bulk supplier payment, debit notes, bill discount.
const { MedicineBatch, Medicine, StockLog, Purchase } = require('../../models/pharmacy');
const svc = require('../../services/pharmacy/purchase.service');
const { inDays, makeStore, expectApiError } = require('./helpers');

const line = (store, over = {}) => ({
    medicine_id: store.medicine._id.toString(),
    batch_number: 'ASC-LS-09',
    expiry_date: inDays(400).toISOString(),
    quantity: 10,
    purchase_rate: 70,
    mrp: 120,
    sale_price: 110,
    gst_rate: 12,
    ...over,
});

const stockOf = async (batchId) => (await MedicineBatch.findById(batchId)).current_stock;

describe('suppliers', () => {
    test('create requires a name and rejects case-insensitive duplicates', async () => {
        const { branch } = await makeStore();
        await expectApiError(svc.createSupplier(branch._id, { name: '  ' }), 'SUPPLIER_NAME_REQUIRED', 400);
        const s = await svc.createSupplier(branch._id, { name: 'Demo Pharma', phone: '98765', gstin: '27abc' });
        expect(s.name).toBe('Demo Pharma');
        expect(s.gstin).toBe('27ABC');
        await expectApiError(svc.createSupplier(branch._id, { name: 'demo pharma' }), 'SUPPLIER_EXISTS', 409);
    });

    test('update and deactivate', async () => {
        const { branch } = await makeStore();
        const s = await svc.createSupplier(branch._id, { name: 'A' });
        const u = await svc.updateSupplier(branch._id, s._id, { phone: '111', is_active: false });
        expect(u.phone).toBe('111');
        expect(u.is_active).toBe(false);
        expect(await svc.getSuppliers(branch._id)).toHaveLength(0);
        expect(await svc.getSuppliers(branch._id, { include_inactive: 'true' })).toHaveLength(1);
        await expectApiError(svc.updateSupplier(branch._id, s._id, { name: '' }), 'SUPPLIER_NAME_REQUIRED', 400);
    });

    test('suppliers are isolated per branch', async () => {
        const a = await makeStore();
        const b = await makeStore();
        const s = await svc.createSupplier(a.branch._id, { name: 'Only A' });
        await expectApiError(svc.getSupplierById(b.branch._id, s._id), 'SUPPLIER_NOT_FOUND', 404);
    });
});

describe('createPurchase', () => {
    test('totals, payment status, stock inward incl. free goods, prices and stock log', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, {
            supplier_id: sup._id,
            supplier_invoice_number: 'DPD/101',
            payment_mode: 'CASH',
            amount_paid: 500,
            items: [line(store, { free_quantity: 1, discount_percent: 5, purchase_rate: 72, mrp: 125, sale_price: 115 })],
        });
        // 10 x 72 = 720, 5% = 36, taxable 684, GST 12% = 82.08, total 766.08
        expect(p.subtotal).toBe(720);
        expect(p.discount_amount).toBe(36);
        expect(p.taxable_amount).toBe(684);
        expect(p.total_tax).toBe(82.08);
        expect(p.cgst + p.sgst).toBeCloseTo(82.08, 2);
        expect(p.grand_total).toBe(766.08);
        expect(p.amount_paid).toBe(500);
        expect(p.balance_due).toBe(266.08);
        expect(p.payment_status).toBe('PARTIAL');
        expect(p.purchase_number).toMatch(/^PUR-\d{6}-0001$/);

        expect(await stockOf(store.batch._id)).toBe(79 + 11);
        const med = await Medicine.findById(store.medicine._id);
        expect(med.purchase_rate).toBe(72);
        expect(med.mrp).toBe(125);
        const log = await StockLog.findOne({ batch_id: store.batch._id, reference_type: 'PURCHASE' });
        expect(log.quantity).toBe(11);
        expect(log.balance_after).toBe(90);
        expect(String(log.reference_id)).toBe(String(p._id));
    });

    test('new batch number creates a new batch; credit purchase is UNPAID', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store, { batch_number: 'NEW-01', quantity: 5 })] });
        expect(p.payment_status).toBe('UNPAID');
        expect(p.balance_due).toBe(p.grand_total);
        const nb = await MedicineBatch.findOne({ medicine_id: store.medicine._id, batch_number: 'NEW-01' });
        expect(nb.current_stock).toBe(5);
        expect(await stockOf(store.batch._id)).toBe(79);
    });

    test('purchase numbers increase per branch', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const a = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store)] });
        const b = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store)] });
        expect(a.purchase_number.endsWith('0001')).toBe(true);
        expect(b.purchase_number.endsWith('0002')).toBe(true);
    });

    test('inline new supplier is created and reused', async () => {
        const store = await makeStore();
        const p1 = await svc.createPurchase(store.branch._id, store.user, { supplier: { name: 'Walk-in Distributor' }, items: [line(store)] });
        const p2 = await svc.createPurchase(store.branch._id, store.user, { supplier: { name: 'walk-in distributor' }, items: [line(store)] });
        expect(String(p1.supplier_id)).toBe(String(p2.supplier_id));
    });

    test('bill-level discount is pro-rated over lines before GST', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const med2 = await Medicine.create({ branch_id: store.branch._id, category_id: store.category._id, name: 'ORS', mrp: 60, sale_price: 55, purchase_rate: 40, gst_rate: 5 });
        const p = await svc.createPurchase(store.branch._id, store.user, {
            supplier_id: sup._id,
            bill_discount_percent: 10,
            items: [
                line(store),
                { medicine_id: med2._id, batch_number: 'ORS1', expiry_date: inDays(500), quantity: 5, purchase_rate: 40, mrp: 60, gst_rate: 5 },
            ],
        });
        // 700 @12% + 200 @5% = 900 taxable; 10% = 90 -> 70 + 20
        expect(p.bill_discount_amount).toBe(90);
        expect(p.taxable_amount).toBe(810);
        expect(p.items[0].taxable_amount).toBe(630);
        expect(p.items[1].taxable_amount).toBe(180);
        expect(p.total_tax).toBe(84.6); // 75.6 + 9
        expect(p.grand_total).toBe(894.6);
    });

    test('flat bill discount amount and its validation', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, bill_discount_amount: 14, items: [line(store)] });
        expect(p.bill_discount_percent).toBe(2);
        expect(p.grand_total).toBe(768.32); // 686 + 82.32
        await expectApiError(
            svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, bill_discount_amount: 5000, items: [line(store)] }),
            'INVALID_DISCOUNT',
            400
        );
    });

    test.each([
        ['past expiry', { expiry_date: inDays(-5).toISOString() }, 'INVALID_EXPIRY_DATE'],
        ['MRP below rate', { mrp: 50 }, 'INVALID_MRP'],
        ['sale above MRP', { sale_price: 130 }, 'INVALID_PRICE'],
        ['zero quantity', { quantity: 0 }, 'INVALID_QUANTITY'],
        ['missing batch', { batch_number: ' ' }, 'BATCH_NUMBER_REQUIRED'],
    ])('rejects %s', async (_label, over, code) => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        await expectApiError(svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store, over)] }), code, 400);
    });

    test('an invalid later line leaves stock untouched (validate before inward)', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        await expectApiError(
            svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store), line(store, { mrp: 1 })] }),
            'INVALID_MRP'
        );
        expect(await stockOf(store.batch._id)).toBe(79);
        expect(await Purchase.countDocuments({ branch_id: store.branch._id })).toBe(0);
    });

    test('needs items and a supplier', async () => {
        const store = await makeStore();
        await expectApiError(svc.createPurchase(store.branch._id, store.user, { supplier: { name: 'X' }, items: [] }), 'ITEMS_REQUIRED', 400);
        await expectApiError(svc.createPurchase(store.branch._id, store.user, { items: [line(store)] }), 'SUPPLIER_REQUIRED', 400);
    });

    test('a medicine from another branch is refused', async () => {
        const a = await makeStore();
        const b = await makeStore();
        const sup = await svc.createSupplier(a.branch._id, { name: 'Demo' });
        await expectApiError(svc.createPurchase(a.branch._id, a.user, { supplier_id: sup._id, items: [line(b)] }), 'MEDICINE_NOT_FOUND', 404);
    });

    test('duplicate supplier bill number is blocked unless confirmed; cancelled bills do not count', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const first = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, supplier_invoice_number: 'B-1', items: [line(store)] });
        await expectApiError(
            svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, supplier_invoice_number: 'b-1', items: [line(store)] }),
            'DUPLICATE_SUPPLIER_BILL',
            409
        );
        const dup = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, supplier_invoice_number: 'B-1', allow_duplicate: true, items: [line(store)] });
        expect(dup.purchase_number).not.toBe(first.purchase_number);
        await svc.cancelPurchase(store.branch._id, first._id, store.user);
        await svc.cancelPurchase(store.branch._id, dup._id, store.user);
        await expect(svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, supplier_invoice_number: 'B-1', items: [line(store)] })).resolves.toBeTruthy();
    });
});

describe('payments', () => {
    test('record payments until PAID; guards amount and mode', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store)] }); // 784
        await expectApiError(svc.addPurchasePayment(store.branch._id, p._id, store.user, { amount: 0 }), 'INVALID_AMOUNT', 400);
        await expectApiError(svc.addPurchasePayment(store.branch._id, p._id, store.user, { amount: 10, mode: 'CREDIT' }), 'INVALID_PAYMENT_MODE', 400);
        await expectApiError(svc.addPurchasePayment(store.branch._id, p._id, store.user, { amount: 10, mode: 'DEBIT_NOTE' }), 'INVALID_PAYMENT_MODE', 400);
        await expectApiError(svc.addPurchasePayment(store.branch._id, p._id, store.user, { amount: 1000 }), 'AMOUNT_EXCEEDS_DUE', 400);

        const half = await svc.addPurchasePayment(store.branch._id, p._id, store.user, { amount: 400, mode: 'UPI', reference: 'UTR1' });
        expect(half.payment_status).toBe('PARTIAL');
        expect(half.balance_due).toBe(384);
        const full = await svc.addPurchasePayment(store.branch._id, p._id, store.user, { amount: 384, mode: 'BANK' });
        expect(full.payment_status).toBe('PAID');
        expect(full.balance_due).toBe(0);
        expect(full.payments).toHaveLength(2);
    });
});

describe('cancelPurchase', () => {
    test('reverses all stock, drops out of payables and blocks payments', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store, { free_quantity: 1 })] });
        expect(await stockOf(store.batch._id)).toBe(90);
        expect((await svc.getPurchaseSummary(store.branch._id)).outstanding).toBe(784);

        const c = await svc.cancelPurchase(store.branch._id, p._id, store.user, { reason: 'entered twice' });
        expect(c.status).toBe('CANCELLED');
        expect(c.cancel_reason).toBe('entered twice');
        expect(c.balance_due).toBe(0);
        expect(await stockOf(store.batch._id)).toBe(79);

        const sum = await svc.getPurchaseSummary(store.branch._id);
        expect(sum.outstanding).toBe(0);
        expect(sum.month_total).toBe(0);
        await expectApiError(svc.addPurchasePayment(store.branch._id, p._id, store.user, { amount: 10 }), 'PURCHASE_CANCELLED', 400);
        await expectApiError(svc.cancelPurchase(store.branch._id, p._id, store.user), 'ALREADY_CANCELLED', 400);
    });

    test('refuses (all-or-nothing) when received stock was already sold', async () => {
        const store = await makeStore({ stock: 0 });
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const med2 = await Medicine.create({ branch_id: store.branch._id, category_id: store.category._id, name: 'ORS', mrp: 60, purchase_rate: 40, gst_rate: 5 });
        const p = await svc.createPurchase(store.branch._id, store.user, {
            supplier_id: sup._id,
            items: [line(store), { medicine_id: med2._id, batch_number: 'ORS1', expiry_date: inDays(500), quantity: 5, purchase_rate: 40, mrp: 60, gst_rate: 5 }],
        });
        const orsBatch = await MedicineBatch.findOne({ medicine_id: med2._id });
        orsBatch.current_stock = 2; // 3 sold
        await orsBatch.save();

        await expectApiError(svc.cancelPurchase(store.branch._id, p._id, store.user), 'STOCK_ALREADY_USED', 400);
        expect(await stockOf(store.batch._id)).toBe(10); // first line untouched
        expect((await Purchase.findById(p._id)).status).toBe('RECEIVED');
    });
});

describe('listing and summary', () => {
    test('filters by payment status, cancelled and search; summary counts unpaid', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const paid = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, payment_mode: 'CASH', amount_paid: 784, items: [line(store)] });
        const unpaid = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, supplier_invoice_number: 'FIND-ME', items: [line(store)] });
        const gone = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store)] });
        await svc.cancelPurchase(store.branch._id, gone._id, store.user);

        const ids = (r) => r.purchases.map((p) => String(p._id));
        expect(ids(await svc.getPurchases(store.branch._id, { payment_status: 'PAID' }))).toEqual([String(paid._id)]);
        expect(ids(await svc.getPurchases(store.branch._id, { payment_status: 'UNPAID' }))).toEqual([String(unpaid._id)]);
        expect(ids(await svc.getPurchases(store.branch._id, { payment_status: 'CANCELLED' }))).toEqual([String(gone._id)]);
        expect(ids(await svc.getPurchases(store.branch._id, { search: 'find-me' }))).toEqual([String(unpaid._id)]);
        expect((await svc.getPurchases(store.branch._id, { search: 'ascoril' })).pagination.total).toBe(3);

        const sum = await svc.getPurchaseSummary(store.branch._id);
        expect(sum).toMatchObject({ month_bills: 2, month_total: 1568, outstanding: 784, unpaid_bills: 1, suppliers: 1 });
        const [s] = await svc.getSuppliers(store.branch._id);
        expect(s.outstanding).toBe(784);
        expect(s.unpaid_bills).toBe(1);
    });
});

describe('supplier ledger and bulk payment', () => {
    test('pays oldest bills first and the ledger keeps a running balance', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const b1 = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, invoice_date: inDays(-3), items: [line(store, { quantity: 2 })] }); // 156.8
        const b2 = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, invoice_date: inDays(-1), items: [line(store, { quantity: 4 })] }); // 313.6

        await expectApiError(svc.paySupplier(store.branch._id, sup._id, store.user, { amount: 1000 }), 'AMOUNT_EXCEEDS_DUE', 400);
        const r = await svc.paySupplier(store.branch._id, sup._id, store.user, { amount: 200, mode: 'UPI', reference: 'BULK1' });
        expect(r.allocated.map((a) => [a.purchase_number, a.amount, a.payment_status])).toEqual([
            [b1.purchase_number, 156.8, 'PAID'],
            [b2.purchase_number, 43.2, 'PARTIAL'],
        ]);
        expect(r.outstanding_after).toBe(270.4);

        const l = await svc.getSupplierLedger(store.branch._id, sup._id);
        expect(l.totals).toMatchObject({ billed: 470.4, paid: 200, returned: 0, balance: 270.4, outstanding: 270.4, unpaid_bills: 1, bills: 2 });
        expect(l.entries.map((e) => e.type)).toEqual(['BILL', 'BILL', 'PAYMENT', 'PAYMENT']);
        expect(l.entries[l.entries.length - 1].balance).toBe(270.4);
    });

    test('explicit allocations must target this supplier\'s unpaid bills', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const b1 = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store)] });
        await expectApiError(
            svc.paySupplier(store.branch._id, sup._id, store.user, { allocations: [{ purchase_id: b1._id, amount: 99999 }] }),
            'INVALID_ALLOCATION',
            400
        );
        const r = await svc.paySupplier(store.branch._id, sup._id, store.user, { mode: 'CASH', allocations: [{ purchase_id: b1._id, amount: 100 }] });
        expect(r.amount).toBe(100);
    });

    test('payments on a cancelled bill show as refund due', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, payment_mode: 'CASH', amount_paid: 500, items: [line(store)] });
        await svc.cancelPurchase(store.branch._id, p._id, store.user);
        const l = await svc.getSupplierLedger(store.branch._id, sup._id);
        expect(l.totals.billed).toBe(0);
        expect(l.totals.balance).toBe(-500);
        expect(l.entries[0].particulars).toMatch(/refund due/);
    });
});

describe('purchase returns (debit notes)', () => {
    test('stock leaves the batch and the value is adjusted against the bill', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, bill_discount_percent: 2, items: [line(store)] }); // 768.32
        const batchId = p.items[0].batch_id;
        expect(await stockOf(batchId)).toBe(89);

        const r = await svc.createPurchaseReturn(store.branch._id, store.user, {
            purchase_id: p._id,
            settlement: 'ADJUST_PAYABLE',
            reason: 'Damaged',
            items: [{ batch_id: batchId, quantity: 3 }],
        });
        expect(r.debit_note_number).toMatch(/^DN-\d{6}-0001$/);
        expect(r.grand_total).toBe(235.2); // 3 x 70 + 12%
        expect(r.adjusted_amount).toBe(235.2);
        expect(r.settlement).toBe('ADJUST_PAYABLE');
        expect(await stockOf(batchId)).toBe(86);

        const bill = await Purchase.findById(p._id);
        expect(bill.balance_due).toBe(533.12);
        expect(bill.payment_status).toBe('PARTIAL');
        expect(bill.payments[0].mode).toBe('DEBIT_NOTE');

        const l = await svc.getSupplierLedger(store.branch._id, sup._id);
        expect(l.totals.returned).toBe(235.2);
        expect(l.entries.map((e) => e.type)).toEqual(['BILL', 'RETURN']); // DEBIT_NOTE payment not double counted
        expect(l.totals.balance).toBe(533.12);

        const list = await svc.getPurchaseReturns(store.branch._id, { search: 'ascoril' });
        expect(list.pagination.total).toBe(1);
    });

    test('adjustment is capped at the bill due; the rest stays pending', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, payment_mode: 'CASH', amount_paid: 700, items: [line(store)] }); // due 84
        const r = await svc.createPurchaseReturn(store.branch._id, store.user, {
            purchase_id: p._id, settlement: 'ADJUST_PAYABLE', items: [{ batch_id: p.items[0].batch_id, quantity: 5 }],
        });
        expect(r.grand_total).toBe(392);
        expect(r.adjusted_amount).toBe(84);
        expect((await Purchase.findById(p._id)).payment_status).toBe('PAID');
    });

    test('pending / refund settlement leaves the bill due unchanged', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store)] });
        const r = await svc.createPurchaseReturn(store.branch._id, store.user, { purchase_id: p._id, settlement: 'REFUND', items: [{ batch_id: p.items[0].batch_id, quantity: 1 }] });
        expect(r.adjusted_amount).toBe(0);
        expect((await Purchase.findById(p._id)).balance_due).toBe(784);
    });

    test('cannot return more than in stock, against a cancelled bill, or with a bad settlement', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const p = await svc.createPurchase(store.branch._id, store.user, { supplier_id: sup._id, items: [line(store)] });
        await expectApiError(
            svc.createPurchaseReturn(store.branch._id, store.user, { purchase_id: p._id, items: [{ batch_id: p.items[0].batch_id, quantity: 500 }] }),
            'INSUFFICIENT_STOCK',
            400
        );
        await expectApiError(
            svc.createPurchaseReturn(store.branch._id, store.user, { purchase_id: p._id, settlement: 'BARTER', items: [{ batch_id: p.items[0].batch_id, quantity: 1 }] }),
            'INVALID_SETTLEMENT',
            400
        );
        await expectApiError(svc.createPurchaseReturn(store.branch._id, store.user, { purchase_id: p._id, items: [] }), 'ITEMS_REQUIRED', 400);
        await svc.cancelPurchase(store.branch._id, p._id, store.user);
        await expectApiError(
            svc.createPurchaseReturn(store.branch._id, store.user, { purchase_id: p._id, items: [{ batch_id: p.items[0].batch_id, quantity: 1 }] }),
            'PURCHASE_CANCELLED',
            400
        );
    });

    test('return without a bill (supplier only) is left pending', async () => {
        const store = await makeStore();
        const sup = await svc.createSupplier(store.branch._id, { name: 'Demo' });
        const r = await svc.createPurchaseReturn(store.branch._id, store.user, {
            supplier_id: sup._id, settlement: 'ADJUST_PAYABLE', items: [{ batch_id: store.batch._id, quantity: 2 }],
        });
        expect(r.settlement).toBe('PENDING');
        expect(r.grand_total).toBe(156.8);
        expect(await stockOf(store.batch._id)).toBe(77);
    });
});
