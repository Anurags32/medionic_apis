// Onboarding: customers with opening khata (manual + Excel import), trial
// starting at approval, and 0% GST being a real rate.
const bcrypt = require('bcryptjs');
const { Customer, Medicine, MedicineBatch, User, Branch, Invoice } = require('../../models/pharmacy');
const customers = require('../../services/pharmacy/customer.service');
const inventory = require('../../services/pharmacy/inventory.service');
const pos = require('../../services/pharmacy/pos.service');
const { approvePharmacyOwner } = require('../../controllers/adminController');
const { inDays, makeStore, expectApiError } = require('./helpers');

describe('customer opening khata', () => {
    test('manual add with opening balance; ledger shows it; settling reduces it', async () => {
        const { branch } = await makeStore();
        const c = await customers.createCustomer(branch._id, { name: 'Rahul Verma', phone: '9876543210', opening_balance: '1240.50' });
        expect(c.khata_balance).toBe(1240.5);
        expect(c.opening_balance).toBe(1240.5);

        const ledger = await customers.getCustomerLedger(branch._id, c._id);
        expect(ledger.opening_balance).toBe(1240.5);
        expect(ledger.ledger.find((e) => e.is_opening_balance)).toMatchObject({ invoice_number: 'Opening balance', balance_due: 1240.5 });

        const s = await customers.settleKhataPayment(branch._id, c._id, 240.5, 'CASH');
        expect(s.remaining_khata_balance).toBe(1000);
    });

    test('negative opening balance is refused; no balance means 0', async () => {
        const { branch } = await makeStore();
        await expectApiError(customers.createCustomer(branch._id, { name: 'X', phone: '9876500011', opening_balance: -5 }), 'INVALID_OPENING_BALANCE', 400);
        const c = await customers.createCustomer(branch._id, { name: 'Y', phone: '9876500012' });
        expect(c.khata_balance).toBe(0);
        expect(c.opening_balance).toBe(0);
    });

    test('a later credit bill adds on top of the opening balance', async () => {
        const store = await makeStore();
        await customers.createCustomer(store.branch._id, { name: 'Rahul', phone: '9876543299', opening_balance: 500 });
        await pos.createInvoice(store.branch._id, store.user.userId, {
            items: [{ medicine_id: store.medicine._id, batch_id: store.batch._id, quantity: 1 }],
            payment_mode: 'KHATA',
            customer_phone: '9876543299',
        });
        expect((await Customer.findOne({ branch_id: store.branch._id, phone: '9876543299' })).khata_balance).toBe(623.2);
    });
});

describe('importCustomers', () => {
    test('Marg / register style headers, phone clean-up and ₹ amounts', async () => {
        const { branch } = await makeStore();
        const s = await customers.importCustomers(branch._id, [
            { 'Party Name': 'Rahul Verma', 'Mobile No': '+91 98765-43210', Balance: '₹1,240.50', City: 'Lucknow' },
            { Customer: 'Sunita Devi', Mobile: '09123456780', Udhaar: '' },
            { Name: 'Amit', Phone: '8123456789', 'Closing Balance': '0' },
        ]);
        expect(s).toMatchObject({ total: 3, created: 3, updated: 0, skipped: 0, failed: 0, opening_khata_total: 1240.5 });
        const rahul = await Customer.findOne({ branch_id: branch._id, phone: '9876543210' });
        expect(rahul.name).toBe('Rahul Verma');
        expect(rahul.khata_balance).toBe(1240.5);
        expect(rahul.opening_balance).toBe(1240.5);
        expect(rahul.city).toBe('Lucknow');
        expect((await Customer.findOne({ branch_id: branch._id, phone: '9123456780' })).khata_balance).toBe(0);
    });

    test('bad rows are reported per sheet row and do not stop the import', async () => {
        const { branch } = await makeStore();
        const s = await customers.importCustomers(branch._id, [
            { name: '', phone: '9876500001' },
            { name: 'No Phone' },
            { name: 'Bad Phone', phone: '12345' },
            { name: 'Advance', phone: '9876500004', balance: '-200' },
            { name: 'Text Amount', phone: '9876500005', balance: 'abc' },
            { name: 'Good', phone: '9876500006', balance: '300' },
            { name: 'Good Again', phone: '9876500006', balance: '50' },
        ]);
        expect(s).toMatchObject({ total: 7, created: 1, skipped: 2, failed: 4, opening_khata_total: 300 });
        expect(s.errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6, 8]);
        expect(s.errors.find((e) => e.row === 4).message).toMatch(/not a valid 10-digit/);
        expect(s.errors.find((e) => e.row === 5).message).toMatch(/Negative/);
        expect(s.errors.find((e) => e.row === 8).message).toMatch(/twice/);
    });

    test('existing customer: gets the opening balance only if they have no khata yet', async () => {
        const { branch } = await makeStore();
        await Customer.create({ branch_id: branch._id, name: 'Fresh', phone: '9876511111', khata_balance: 0 });
        await Customer.create({ branch_id: branch._id, name: 'Has Dues', phone: '9876522222', khata_balance: 75 });
        const s = await customers.importCustomers(branch._id, [
            { name: 'Fresh', phone: '9876511111', balance: 400 },
            { name: 'Has Dues', phone: '9876522222', balance: 999 },
        ]);
        expect(s).toMatchObject({ created: 0, updated: 1, skipped: 1, opening_khata_total: 400 });
        expect((await Customer.findOne({ phone: '9876511111', branch_id: branch._id })).khata_balance).toBe(400);
        expect((await Customer.findOne({ phone: '9876522222', branch_id: branch._id })).khata_balance).toBe(75);
        expect(await Customer.countDocuments({ branch_id: branch._id })).toBe(2);
    });

    test('customers are per store', async () => {
        const a = await makeStore();
        const b = await makeStore();
        await customers.importCustomers(a.branch._id, [{ name: 'Shared', phone: '9876533333', balance: 10 }]);
        const s = await customers.importCustomers(b.branch._id, [{ name: 'Shared', phone: '9876533333', balance: 20 }]);
        expect(s.created).toBe(1);
    });

    test('rejects empty and oversized uploads; template has the documented columns', async () => {
        const { branch } = await makeStore();
        await expectApiError(customers.importCustomers(branch._id, []), 'ROWS_REQUIRED', 400);
        await expectApiError(customers.importCustomers(branch._id, new Array(2001).fill({ name: 'x' })), 'TOO_MANY_ROWS', 400);
        const header = customers.customerImportTemplateCsv().split('\n')[0].split(',');
        expect(header).toEqual(expect.arrayContaining(['name', 'phone', 'opening_balance']));
    });
});

describe('trial starts at approval', () => {
    const makePendingOwner = async (store, over = {}) => User.create({
        full_name: 'Pending Owner',
        email: `pending${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.local`,
        phone: `91${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
        password_hash: await bcrypt.hash('Medcab@123', 4),
        role: 'PHARMACY_OWNER',
        branch_id: store.branch._id,
        approval_status: 'pending',
        is_active: false,
        ...over,
    });
    const approve = (id) => new Promise((resolve, reject) => {
        const res = { status() { return this; }, json: (body) => resolve(body) };
        approvePharmacyOwner({ params: { id: String(id) }, body: {} }, res, reject);
    });

    test('approval 3 days after registration still gives 14 trial days', async () => {
        const store = await makeStore();
        store.branch.subscription = { ...Branch.trialSubscription(), start_date: inDays(-3), expiry_date: inDays(11) };
        await store.branch.save();
        const owner = await makePendingOwner(store);

        const body = await approve(owner._id);
        expect(body.success).toBe(true);
        const sub = (await Branch.findById(store.branch._id)).getSubscriptionDetails();
        expect(sub.plan_id).toBe('trial');
        expect(sub.days_left).toBe(14);
        expect((await User.findById(owner._id)).approval_status).toBe('approved');
    });

    test('a paid plan is never reset by approval', async () => {
        const store = await makeStore();
        store.branch.subscription = { plan_id: 'standard', plan_name: 'Standard', billing_cycle: 'yearly', status: 'ACTIVE', start_date: new Date(), expiry_date: inDays(200) };
        await store.branch.save();
        const owner = await makePendingOwner(store);
        await approve(owner._id);
        const sub = (await Branch.findById(store.branch._id)).getSubscriptionDetails();
        expect(sub.plan_id).toBe('standard');
        expect(sub.days_left).toBe(200);
    });

    test('re-approving an approved owner does not restart the trial', async () => {
        const store = await makeStore();
        store.branch.subscription = { ...Branch.trialSubscription(), start_date: inDays(-10), expiry_date: inDays(4) };
        await store.branch.save();
        const owner = await makePendingOwner(store, { approval_status: 'approved', is_active: true });
        await approve(owner._id);
        expect((await Branch.findById(store.branch._id)).getSubscriptionDetails().days_left).toBe(4);
    });
});

describe('0% GST is a real rate', () => {
    test('a 0% batch is billed without GST even on a GST bill', async () => {
        const store = await makeStore();
        const exempt = await Medicine.create({ branch_id: store.branch._id, category_id: store.category._id, name: 'Exempt Item', mrp: 50, sale_price: 50, gst_rate: 0 });
        const b = await MedicineBatch.create({
            branch_id: store.branch._id, medicine_id: exempt._id, batch_number: 'EX1', expiry_date: inDays(300), purchase_rate: 30, mrp: 50, sale_price: 50, gst_rate: 0, current_stock: 10,
        });
        await pos.createInvoice(store.branch._id, store.user.userId, {
            items: [
                { medicine_id: exempt._id, batch_id: b._id, quantity: 2 },
                { medicine_id: store.medicine._id, batch_id: store.batch._id, quantity: 1 },
            ],
        });
        const inv = await Invoice.findOne({ branch_id: store.branch._id }).sort({ _id: -1 });
        expect(inv.gst_applied).toBe(true);
        expect(inv.items[0].gst_rate).toBe(0);
        expect(inv.items[0].gst_amount).toBe(0);
        expect(inv.total_tax).toBe(13.2); // only the 12% item: 110 x 12%
        expect(inv.grand_total).toBe(223.2);
    });

    test('new batch keeps an explicit 0% and defaults a missing rate to 12%', async () => {
        const store = await makeStore();
        const base = { medicine_id: store.medicine._id, expiry_date: inDays(300), purchase_rate: 70, mrp: 120, initial_stock: 5 };
        const zero = await inventory.createBatch(store.branch._id, store.user.userId, { ...base, batch_number: 'Z0', gst_rate: 0 });
        const missing = await inventory.createBatch(store.branch._id, store.user.userId, { ...base, batch_number: 'M0' });
        expect(zero.gst_rate).toBe(0);
        expect(missing.gst_rate).toBe(12);
    });

    test('import without a GST column uses 12%; an explicit 0 stays 0', async () => {
        const store = await makeStore();
        await inventory.importMedicines(store.branch._id, store.user.userId, [
            { name: 'No GST Column', batch: 'N1', expiry: '01/2029', qty: 5, mrp: 20, ptr: 10 },
            { name: 'Zero GST', batch: 'Z1', expiry: '01/2029', qty: 5, mrp: 20, ptr: 10, gst: '0' },
        ]);
        const noCol = await Medicine.findOne({ branch_id: store.branch._id, name: 'No GST Column' });
        const zero = await Medicine.findOne({ branch_id: store.branch._id, name: 'Zero GST' });
        expect(noCol.gst_rate).toBe(12);
        expect((await MedicineBatch.findOne({ medicine_id: noCol._id })).gst_rate).toBe(12);
        expect(zero.gst_rate).toBe(0);
        expect((await MedicineBatch.findOne({ medicine_id: zero._id })).gst_rate).toBe(0);
    });
});
