// End-to-end over HTTP (supertest): admin manages plans & pricing and store
// subscriptions; the pharmacy app's catalog, checkout and plan status follow.
jest.mock('razorpay', () =>
    jest.fn().mockImplementation(() => ({
        orders: {
            create: jest.fn(async (o) => ({ id: `order_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, amount: o.amount, currency: o.currency })),
        },
    }))
);

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../server');
const { Branch, User: PharmacyUser, PlanPayment, SubscriptionEvent } = require('../../models/pharmacy');
const { inDays } = require('./helpers');

const ADMIN_SECRET = 'e2e-admin-registration-secret';
const OWNER_PASSWORD = 'Onboard@2026';
const RZP_SECRET = 'e2e_rzp_secret';
let adminToken;
let seq = 0;

const admin = (req) => req.set('Authorization', `Bearer ${adminToken}`);
const as = (token) => (req) => req.set('Authorization', `Bearer ${token}`);
const codeOf = (res) => res.body.code || res.body.error?.code;

/** Registers a pharmacy and leaves it waiting for admin approval. */
const pendingStore = async () => {
    seq += 1;
    const tag = `${Date.now().toString().slice(-6)}${seq}`;
    const email = `e2e.pending.${tag}@example.com`;
    const phone = `95${tag}`.padEnd(10, '0').slice(0, 10);
    const storeName = `Waiting Pharmacy ${tag}`;
    const reg = await request(app).post('/api/v1/auth/register').send({
        full_name: 'Waiting Owner',
        email,
        phone,
        password: OWNER_PASSWORD,
        branch_details: { name: storeName, drug_license_no: `DL-WT-20B-${tag}`, gstin: '09AABCT1234F1Z5', address: 'Lucknow, UP', contact_number: phone, email },
    });
    expect(reg.status).toBe(201);
    const owner = await PharmacyUser.findOne({ email });
    return { email, storeName, branchId: String(owner.branch_id), ownerId: String(owner._id) };
};

/** Registers a pharmacy, approves it as admin, logs the owner in. */
const approvedStore = async () => {
    seq += 1;
    const tag = `${Date.now().toString().slice(-6)}${seq}`;
    const email = `e2e.pricing.${tag}@example.com`;
    const phone = `96${tag}`.padEnd(10, '0').slice(0, 10);
    const storeName = `Pricing Pharmacy ${tag}`;
    const reg = await request(app).post('/api/v1/auth/register').send({
        full_name: 'Pricing Owner',
        email,
        phone,
        password: OWNER_PASSWORD,
        branch_details: {
            name: storeName,
            drug_license_no: `DL-PR-20B-${tag}`,
            gstin: '09AABCT1234F1Z5',
            address: 'Shop 2, Test Market, Lucknow, UP 226001',
            contact_number: phone,
            email,
        },
    });
    expect(reg.status).toBe(201);
    const owner = await PharmacyUser.findOne({ email });
    const ok = await admin(request(app).put(`/api/admin/pharmacy-owners/${owner._id}/approve`).send({}));
    expect(ok.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: OWNER_PASSWORD });
    expect(login.status).toBe(200);
    return { email, storeName, branchId: String(owner.branch_id), token: login.body.data.accessToken };
};

const subscriptionOf = async (token) => (await as(token)(request(app).get('/api/v1/branch/subscription'))).body.data;
const catalogOf = async (token) => (await as(token)(request(app).get('/api/v1/branch/plans'))).body.data;

beforeAll(async () => {
    process.env.ADMIN_REGISTRATION_SECRET = ADMIN_SECRET;
    process.env.RAZORPAY_KEY_ID = 'rzp_test_e2e';
    process.env.RAZORPAY_KEY_SECRET = RZP_SECRET;
    const email = `e2e.pricing.admin.${Date.now()}@example.com`;
    const reg = await request(app).post('/api/admin/register').send({
        fullName: 'E2E Admin', email, password: 'Admin@E2E123', secretKey: ADMIN_SECRET, phone: '9000054321',
    });
    expect([200, 201]).toContain(reg.status);
    const login = await request(app).post('/api/admin/login').send({ email, password: 'Admin@E2E123' });
    adminToken = login.body.token || login.body.data?.token;
    expect(adminToken).toBeTruthy();
});

describe('plans & pricing (admin → pharmacy app)', () => {
    let store;
    beforeAll(async () => {
        store = await approvedStore();
    });

    test('admin sees the built-in plans and settings on a fresh database', async () => {
        const res = await admin(request(app).get('/api/admin/pharmacy/plans'));
        expect(res.status).toBe(200);
        const prices = Object.fromEntries(res.body.data.plans.map((p) => [p.plan_id, p.monthly_price]));
        expect(prices).toEqual({ basic: 299, standard: 499, pro: 699 });
        expect(res.body.data.settings).toMatchObject({ trial_days: 14, yearly_months_charged: 10, onboarding_fee: 0 });
    });

    test('a price change shows in the app catalog and is what checkout charges', async () => {
        const put = await admin(request(app).put('/api/admin/pharmacy/plans/standard').send({ monthly_price: 549 }));
        expect(put.status).toBe(200);

        const standard = (await catalogOf(store.token)).plans.find((p) => p.id === 'standard');
        expect(standard).toMatchObject({ monthly_price: 549, yearly_price: 5490, yearly_savings: 1098, purchasable: true });

        const checkout = await as(store.token)(request(app).post('/api/v1/branch/plan/checkout'))
            .send({ plan_id: 'standard', billing_cycle: 'yearly', amount: 1 });
        expect(checkout.status).toBe(201);
        expect(checkout.body.data.amount).toBe(549000); // paise; client amount ignored
    });

    test('new plan appears in the app; a deactivated plan is hidden and cannot be bought', async () => {
        const created = await admin(request(app).post('/api/admin/pharmacy/plans').send({
            plan_id: 'Starter', name: 'Starter', tagline: 'Small counters', monthly_price: 199, features: 'POS billing\n\nStock ledger',
        }));
        expect(created.status).toBe(201);
        expect(created.body.data).toMatchObject({ plan_id: 'starter', features: ['POS billing', 'Stock ledger'], is_active: true });

        expect((await catalogOf(store.token)).plans.map((p) => p.id)).toContain('starter');

        await admin(request(app).put('/api/admin/pharmacy/plans/starter').send({ is_active: false }));
        expect((await catalogOf(store.token)).plans.map((p) => p.id)).not.toContain('starter');

        const buy = await as(store.token)(request(app).post('/api/v1/branch/plan/checkout')).send({ plan_id: 'starter', billing_cycle: 'monthly' });
        expect(buy.status).toBe(400);
        expect(codeOf(buy)).toBe('INVALID_PLAN');
    });

    test('bad plan input is refused', async () => {
        const post = (body) => admin(request(app).post('/api/admin/pharmacy/plans').send(body));
        expect(codeOf(await post({ plan_id: 'trial', name: 'Trial', monthly_price: 10 }))).toBe('INVALID_PLAN_ID');
        expect(codeOf(await post({ plan_id: 'gold plan', name: 'Gold', monthly_price: 10 }))).toBe('INVALID_PLAN_ID');
        expect(codeOf(await post({ plan_id: 'basic', name: 'Basic again', monthly_price: 10 }))).toBe('PLAN_EXISTS');
        expect(codeOf(await post({ plan_id: 'free', name: 'Free', monthly_price: 0 }))).toBe('INVALID_PRICE');
        expect(codeOf(await post({ plan_id: 'cheap', name: 'Cheap', monthly_price: 99.5 }))).toBe('INVALID_PRICE');
        const missing = await admin(request(app).put('/api/admin/pharmacy/plans/nope').send({ monthly_price: 10 }));
        expect(missing.status).toBe(404);
    });

    test('only one plan carries the "Most popular" badge', async () => {
        await admin(request(app).put('/api/admin/pharmacy/plans/basic').send({ popular: true }));
        const plans = (await catalogOf(store.token)).plans;
        expect(plans.filter((p) => p.popular).map((p) => p.id)).toEqual(['basic']);
    });

    test('the last active plan cannot be switched off', async () => {
        await admin(request(app).put('/api/admin/pharmacy/plans/basic').send({ is_active: false }));
        await admin(request(app).put('/api/admin/pharmacy/plans/standard').send({ is_active: false }));
        const last = await admin(request(app).put('/api/admin/pharmacy/plans/pro').send({ is_active: false }));
        expect(last.status).toBe(400);
        expect(codeOf(last)).toBe('LAST_ACTIVE_PLAN');
        await admin(request(app).put('/api/admin/pharmacy/plans/basic').send({ is_active: true }));
        await admin(request(app).put('/api/admin/pharmacy/plans/standard').send({ is_active: true }));
    });

    test('trial length setting applies to stores approved after the change', async () => {
        const bad = await admin(request(app).put('/api/admin/pharmacy/pricing-settings').send({ trial_days: 0 }));
        expect(codeOf(bad)).toBe('INVALID_TRIAL_DAYS');

        const put = await admin(request(app).put('/api/admin/pharmacy/pricing-settings').send({ trial_days: 30, yearly_months_charged: 11 }));
        expect(put.status).toBe(200);
        expect(put.body.data).toMatchObject({ trial_days: 30, yearly_months_charged: 11, updated_by_name: 'E2E Admin' });

        const fresh = await approvedStore();
        expect(await subscriptionOf(fresh.token)).toMatchObject({ plan_id: 'trial', trial_days: 30, days_left: 30 });
        const catalog = await catalogOf(fresh.token);
        expect(catalog.trial_days).toBe(30);
        expect(catalog.plans.find((p) => p.id === 'pro').yearly_price).toBe(699 * 11);

        // Stores approved earlier keep the trial they were given.
        expect((await subscriptionOf(store.token)).days_left).toBe(14);

        await admin(request(app).put('/api/admin/pharmacy/pricing-settings').send({ trial_days: 14, yearly_months_charged: 10 }));
    });
});

describe('store subscriptions (admin)', () => {
    let store;
    beforeAll(async () => {
        store = await approvedStore();
    });

    test('admin extends a trial; the app sees the new expiry and it is logged', async () => {
        const res = await admin(request(app).post(`/api/admin/pharmacy/subscriptions/${store.branchId}/extend-trial`).send({ days: 7, note: 'Demo week' }));
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ plan_id: 'trial', days_left: 21 });
        expect(await subscriptionOf(store.token)).toMatchObject({ plan_id: 'trial', days_left: 21, trial_days: 21 });

        const event = await SubscriptionEvent.findOne({ branch_id: store.branchId, type: 'TRIAL_EXTENDED' });
        expect(event).toMatchObject({ days: 7, note: 'Demo week', actor_name: 'E2E Admin' });

        const bad = await admin(request(app).post(`/api/admin/pharmacy/subscriptions/${store.branchId}/extend-trial`).send({ days: 365 }));
        expect(codeOf(bad)).toBe('INVALID_DAYS');
    });

    test('offline payment activates a paid plan, records the payment and shows in plan history', async () => {
        const res = await admin(request(app).post(`/api/admin/pharmacy/subscriptions/${store.branchId}/activate`).send({
            plan_id: 'pro', billing_cycle: 'monthly', payment_mode: 'upi', reference: 'UPI-REF-001',
        }));
        expect(res.status).toBe(200);
        expect(res.body.data.payment).toMatchObject({ amount: 699, source: 'ADMIN', status: 'PAID', payment_mode: 'UPI', reference: 'UPI-REF-001', recorded_by_name: 'E2E Admin' });

        // Trial days left are not carried over (same rule as online payment).
        expect(await subscriptionOf(store.token)).toMatchObject({ plan_id: 'pro', is_trial: false, billing_cycle: 'monthly', days_left: 30, status: 'ACTIVE' });

        const history = await as(store.token)(request(app).get('/api/v1/branch/plan/history'));
        expect(history.body.data.map((p) => p.reference)).toContain('UPI-REF-001');

        const extend = await admin(request(app).post(`/api/admin/pharmacy/subscriptions/${store.branchId}/extend-trial`).send({ days: 5 }));
        expect(extend.status).toBe(409);
        expect(codeOf(extend)).toBe('NOT_ON_TRIAL');
    });

    test('a discount needs a note; paid time stacks; complimentary is free', async () => {
        const url = `/api/admin/pharmacy/subscriptions/${store.branchId}/activate`;
        const noNote = await admin(request(app).post(url).send({ plan_id: 'pro', billing_cycle: 'monthly', payment_mode: 'CASH', amount: 500 }));
        expect(codeOf(noNote)).toBe('NOTE_REQUIRED');

        const discounted = await admin(request(app).post(url).send({ plan_id: 'pro', billing_cycle: 'monthly', payment_mode: 'CASH', amount: 500, note: 'Festival offer' }));
        expect(discounted.status).toBe(200);
        expect(discounted.body.data.subscription.days_left).toBe(60);

        const free = await admin(request(app).post(url).send({ plan_id: 'pro', billing_cycle: 'monthly', payment_mode: 'COMPLIMENTARY', note: 'Referral reward' }));
        expect(free.body.data.payment.amount).toBe(0);
        expect(free.body.data.subscription.days_left).toBe(90);

        const badMode = await admin(request(app).post(url).send({ plan_id: 'pro', billing_cycle: 'monthly', payment_mode: 'BARTER' }));
        expect(codeOf(badMode)).toBe('INVALID_PAYMENT_MODE');
        const badPlan = await admin(request(app).post(url).send({ plan_id: 'trial', billing_cycle: 'monthly', payment_mode: 'CASH' }));
        expect(codeOf(badPlan)).toBe('INVALID_PLAN');
    });

    test('an expired, read-only store is unlocked by an admin activation', async () => {
        const expired = await approvedStore();
        await Branch.updateOne({ _id: expired.branchId }, { $set: { 'subscription.expiry_date': inDays(-2) } });
        expect(await subscriptionOf(expired.token)).toMatchObject({ status: 'EXPIRED', is_read_only: true });

        const list = await admin(request(app).get('/api/admin/pharmacy/subscriptions').query({ status: 'expired', search: expired.storeName }));
        expect(list.body.data.map((s) => s.name)).toEqual([expired.storeName]);

        await admin(request(app).post(`/api/admin/pharmacy/subscriptions/${expired.branchId}/activate`).send({ plan_id: 'basic', billing_cycle: 'yearly', payment_mode: 'BANK_TRANSFER', reference: 'NEFT-77' }));
        expect(await subscriptionOf(expired.token)).toMatchObject({ plan_id: 'basic', billing_cycle: 'yearly', status: 'ACTIVE', is_read_only: false, days_left: 365 });
        const payment = await PlanPayment.findOne({ branch_id: expired.branchId, source: 'ADMIN' });
        expect(payment.amount).toBe(2990);
    });

    test('online Razorpay payment is logged in the audit trail too', async () => {
        const online = await approvedStore();
        const checkout = await as(online.token)(request(app).post('/api/v1/branch/plan/checkout')).send({ plan_id: 'basic', billing_cycle: 'monthly' });
        const orderId = checkout.body.data.order_id;
        const paymentId = 'pay_e2e_001';
        const signature = crypto.createHmac('sha256', RZP_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
        const verify = await as(online.token)(request(app).post('/api/v1/branch/plan/verify'))
            .send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
        expect(verify.status).toBe(200);
        const event = await SubscriptionEvent.findOne({ branch_id: online.branchId, type: 'PLAN_PAID_ONLINE' });
        expect(event).toMatchObject({ plan_id: 'basic', amount: 299, reference: paymentId, payment_mode: 'RAZORPAY' });
    });

    test('subscription list: search, plan filter, owner details, summary', async () => {
        const res = await admin(request(app).get('/api/admin/pharmacy/subscriptions').query({ search: store.storeName }));
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        const row = res.body.data[0];
        expect(row.owner).toMatchObject({ email: store.email, approval_status: 'approved' });
        expect(row.subscription).toMatchObject({ plan_id: 'pro' });
        expect(row.last_payment).toMatchObject({ source: 'ADMIN' });

        const byOwnerEmail = await admin(request(app).get('/api/admin/pharmacy/subscriptions').query({ search: store.email }));
        expect(byOwnerEmail.body.data.map((s) => s.id)).toEqual([store.branchId]);

        const trials = await admin(request(app).get('/api/admin/pharmacy/subscriptions').query({ plan: 'trial', limit: 100 }));
        expect(trials.body.data.every((s) => s.subscription.plan_id === 'trial')).toBe(true);
        expect(trials.body.pagination).toMatchObject({ page: 1, limit: 100 });

        const { summary } = res.body;
        expect(summary.total_stores).toBe(summary.on_trial + summary.on_paid_plan);
        expect(summary.revenue_this_month).toBeGreaterThanOrEqual(699 + 500);
        expect(summary.expired).toBeGreaterThanOrEqual(0);
    });

    test('a store awaiting approval is never counted as expiring or expired', async () => {
        const list = (q) => admin(request(app).get('/api/admin/pharmacy/subscriptions').query({ limit: 100, ...q }));
        const before = (await list({})).body.summary;

        // Registered long ago and still not approved: the stored trial date has passed.
        const waiting = await pendingStore();
        await Branch.updateOne({ _id: waiting.branchId }, { $set: { 'subscription.expiry_date': inDays(-5) } });

        const res = await list({ search: waiting.storeName });
        expect(res.body.data[0]).toMatchObject({ awaiting_approval: true, owner: { approval_status: 'pending' } });
        const after = res.body.summary;
        expect(after.expired).toBe(before.expired);
        expect(after.expiring_in_7_days).toBe(before.expiring_in_7_days);
        expect(after.awaiting_approval).toBe(before.awaiting_approval + 1);
        expect(after.on_trial).toBe(before.on_trial + 1);

        const ids = async (status) => (await list({ status })).body.data.map((s) => s.id);
        expect(await ids('expired')).not.toContain(waiting.branchId);
        expect(await ids('active')).not.toContain(waiting.branchId);
        expect(await ids('awaiting')).toContain(waiting.branchId);

        // Extending its trial would be wiped by approval, so it is refused.
        const extend = await admin(request(app).post(`/api/admin/pharmacy/subscriptions/${waiting.branchId}/extend-trial`).send({ days: 7 }));
        expect(extend.status).toBe(409);
        expect(codeOf(extend)).toBe('AWAITING_APPROVAL');

        // Once approved it gets a fresh trial and leaves the awaiting bucket.
        await admin(request(app).put(`/api/admin/pharmacy-owners/${waiting.ownerId}/approve`).send({}));
        const approved = (await list({ search: waiting.storeName })).body.data[0];
        expect(approved).toMatchObject({ awaiting_approval: false, subscription: { status: 'ACTIVE', days_left: 14 } });
        expect(await ids('awaiting')).not.toContain(waiting.branchId);

        // A rejected store stays out of expiring/expired too.
        const rejected = await pendingStore();
        await Branch.updateOne({ _id: rejected.branchId }, { $set: { 'subscription.expiry_date': inDays(-1) } });
        await admin(request(app).put(`/api/admin/pharmacy-owners/${rejected.ownerId}/reject`).send({ reason: 'Licence mismatch' }));
        expect(await ids('expired')).not.toContain(rejected.branchId);
        expect(await ids('awaiting')).toContain(rejected.branchId);
    });

    test('store history lists every change with who made it', async () => {
        const res = await admin(request(app).get(`/api/admin/pharmacy/subscriptions/${store.branchId}/history`));
        expect(res.status).toBe(200);
        const types = res.body.data.events.map((e) => e.type);
        expect(types).toEqual(expect.arrayContaining(['TRIAL_STARTED', 'TRIAL_EXTENDED', 'PLAN_ACTIVATED']));
        expect(res.body.data.payments.length).toBe(3);

        const missing = await admin(request(app).get('/api/admin/pharmacy/subscriptions/000000000000000000000000/history'));
        expect(missing.status).toBe(404);
    });
});

describe('"this month" uses Indian time', () => {
    const { istMonthStart } = require('../../services/pharmacy/subscriptionAdmin.service');

    test('mid-month: the 1st at 00:00 IST', () => {
        expect(istMonthStart(new Date('2026-11-15T10:00:00Z')).toISOString()).toBe('2026-10-31T18:30:00.000Z');
    });

    test('00:30 IST on the 1st is already the new month (still the 30th in UTC)', () => {
        expect(istMonthStart(new Date('2026-11-30T19:00:00Z')).toISOString()).toBe('2026-11-30T18:30:00.000Z');
    });

    test('23:59 IST on the last day is still the old month', () => {
        expect(istMonthStart(new Date('2026-11-30T18:29:00Z')).toISOString()).toBe('2026-10-31T18:30:00.000Z');
    });

    test('year change', () => {
        expect(istMonthStart(new Date('2026-12-31T18:45:00Z')).toISOString()).toBe('2026-12-31T18:30:00.000Z');
    });
});

describe('access control', () => {
    test('the old owner self-renew endpoints are gone', async () => {
        const store = await approvedStore();
        for (const path of ['/api/v1/branch/subscription/renew', '/api/v1/branch/plan/renew']) {
            const res = await as(store.token)(request(app).post(path)).send({ days: 365, plan: 'ENTERPRISE' });
            expect(res.status).toBe(404);
        }
        expect(await subscriptionOf(store.token)).toMatchObject({ plan_id: 'trial', days_left: 14 });
    });

    test('pricing and subscription admin endpoints refuse anonymous and pharmacy-owner tokens', async () => {
        const store = await approvedStore();
        const calls = [
            (r) => r.get('/api/admin/pharmacy/plans'),
            (r) => r.put('/api/admin/pharmacy/plans/basic').send({ monthly_price: 1 }),
            (r) => r.put('/api/admin/pharmacy/pricing-settings').send({ trial_days: 90 }),
            (r) => r.get('/api/admin/pharmacy/subscriptions'),
            (r) => r.post(`/api/admin/pharmacy/subscriptions/${store.branchId}/activate`).send({ plan_id: 'pro', billing_cycle: 'yearly', payment_mode: 'COMPLIMENTARY', note: 'x' }),
        ];
        for (const call of calls) {
            expect((await call(request(app))).status).toBe(401);
            expect([401, 403]).toContain((await call(request(app)).set('Authorization', `Bearer ${store.token}`)).status);
        }
        expect(await subscriptionOf(store.token)).toMatchObject({ plan_id: 'trial' });
    });
});
