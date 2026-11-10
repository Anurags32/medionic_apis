// Plans: catalog, trial subscription, plan status, Razorpay checkout/verify, planGuard.
jest.mock('razorpay', () =>
    jest.fn().mockImplementation(() => ({
        orders: {
            create: jest.fn(async (o) => ({ id: `order_mock_${Date.now()}`, amount: o.amount, currency: o.currency })),
        },
    }))
);

const crypto = require('crypto');
const { Branch, PlanPayment } = require('../../models/pharmacy');
const plans = require('../../config/pharmacyPlans');
const branchService = require('../../services/pharmacy/branch.service');
const { planGuard } = require('../../middleware/pharmacy/subscription.middleware');
const { inDays, makeStore, expectApiError } = require('./helpers');

const sign = (orderId, paymentId, secret) =>
    crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

describe('plan catalog (config/pharmacyPlans.js)', () => {
    test('14-day free trial, no onboarding fee, import included', () => {
        const c = plans.planCatalog();
        expect(c.trial_days).toBe(14);
        expect(c.onboarding_fee).toBe(0);
        expect(c.data_import_included).toBe(true);
        const trial = c.plans.find((p) => p.id === 'trial');
        expect(trial.monthly_price).toBe(0);
        expect(trial.purchasable).toBe(false);
    });

    test('per-branch monthly prices 299 / 499 / 699', () => {
        const paid = plans.PLANS.filter((p) => p.purchasable);
        expect(Object.fromEntries(paid.map((p) => [p.id, p.monthly_price]))).toEqual({ basic: 299, standard: 499, pro: 699 });
    });

    test('yearly bills 10 months (2 months free)', () => {
        for (const p of plans.planCatalog().plans.filter((x) => x.purchasable)) {
            expect(p.yearly_price).toBe(p.monthly_price * 10);
            expect(p.yearly_savings).toBe(p.monthly_price * 2);
        }
        expect(plans.planAmount(plans.getPlan('standard'), plans.getCycle('yearly'))).toBe(4990);
        expect(plans.planAmount(plans.getPlan('basic'), plans.getCycle('monthly'))).toBe(299);
    });

    test('getPlan / getCycle are case-insensitive and reject unknowns', () => {
        expect(plans.getPlan('PRO').id).toBe('pro');
        expect(plans.getPlan('gold')).toBeNull();
        expect(plans.getCycle('Yearly').days).toBe(365);
        expect(plans.getCycle('weekly')).toBeNull();
    });
});

describe('branch subscription status', () => {
    const OLD_GRACE = process.env.PLAN_GRACE_DAYS;
    afterEach(() => {
        if (OLD_GRACE === undefined) delete process.env.PLAN_GRACE_DAYS;
        else process.env.PLAN_GRACE_DAYS = OLD_GRACE;
    });

    test('a new branch starts on the 14-day trial', () => {
        const b = new Branch({ name: 'x', code: 'X', drug_license_no: 'd', gstin: 'g', address: 'a', contact_number: '1' });
        const s = b.getSubscriptionDetails();
        expect(s.plan_id).toBe('trial');
        expect(s.is_trial).toBe(true);
        expect(s.status).toBe('ACTIVE');
        expect(s.days_left).toBe(14);
    });

    test('trialSubscription() is 14 days from now', () => {
        const t = Branch.trialSubscription();
        expect(Math.round((t.expiry_date - t.start_date) / 86400000)).toBe(14);
        expect(t.billing_cycle).toBe('trial');
    });

    test('expiring within 7 days', () => {
        const b = new Branch({ subscription: { plan_id: 'basic', plan_name: 'Basic', expiry_date: inDays(3) } });
        expect(b.getSubscriptionDetails().status).toBe('EXPIRING_SOON');
    });

    test('expired with no grace is read-only', () => {
        process.env.PLAN_GRACE_DAYS = '0';
        const s = new Branch({ subscription: { plan_id: 'basic', expiry_date: inDays(-1) } }).getSubscriptionDetails();
        expect(s.status).toBe('EXPIRED');
        expect(s.is_read_only).toBe(true);
    });

    test('expired inside grace period is GRACE (still writable)', () => {
        process.env.PLAN_GRACE_DAYS = '3';
        const s = new Branch({ subscription: { plan_id: 'basic', expiry_date: inDays(-1) } }).getSubscriptionDetails();
        expect(s.status).toBe('GRACE');
        expect(s.is_read_only).toBe(false);
    });
});

describe('plan checkout and verification', () => {
    const OLD = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
    const SECRET = 'unit_test_secret';
    beforeEach(() => {
        process.env.RAZORPAY_KEY_ID = 'rzp_test_unit';
        process.env.RAZORPAY_KEY_SECRET = SECRET;
    });
    afterAll(() => {
        process.env.RAZORPAY_KEY_ID = OLD.id;
        process.env.RAZORPAY_KEY_SECRET = OLD.secret;
        if (OLD.id === undefined) delete process.env.RAZORPAY_KEY_ID;
        if (OLD.secret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    });

    test('checkout prices come from the catalog, not the client', async () => {
        const { branch, user } = await makeStore();
        const co = await branchService.createPlanCheckout(branch._id, { plan_id: 'standard', billing_cycle: 'yearly', amount: 1 }, user);
        expect(co.amount).toBe(4990 * 100);
        expect(co.key_id).toBe('rzp_test_unit');
        const pay = await PlanPayment.findById(co.payment_id);
        expect(pay.status).toBe('CREATED');
        expect(pay.amount).toBe(4990);
    });

    test('trial and unknown plans cannot be bought', async () => {
        const { branch, user } = await makeStore();
        await expectApiError(branchService.createPlanCheckout(branch._id, { plan_id: 'trial' }, user), 'INVALID_PLAN', 400);
        await expectApiError(branchService.createPlanCheckout(branch._id, { plan_id: 'basic', billing_cycle: 'weekly' }, user), 'INVALID_BILLING_CYCLE', 400);
    });

    test('only the owner can recharge', async () => {
        const { branch, user } = await makeStore();
        await expectApiError(branchService.createPlanCheckout(branch._id, { plan_id: 'basic' }, { ...user, role: 'PHARMACIST' }), 'OWNER_ONLY', 403);
    });

    test('missing Razorpay keys -> 503', async () => {
        delete process.env.RAZORPAY_KEY_ID;
        const { branch, user } = await makeStore();
        await expectApiError(branchService.createPlanCheckout(branch._id, { plan_id: 'basic' }, user), 'PAYMENT_NOT_CONFIGURED', 503);
    });

    test('valid signature activates the plan; trial days are not carried over', async () => {
        const { branch, user } = await makeStore();
        await PlanPayment.create({ branch_id: branch._id, plan_id: 'standard', plan_name: 'Standard', billing_cycle: 'yearly', amount: 4990, razorpay_order_id: 'order_v1' });
        const r = await branchService.verifyPlanPayment(branch._id, {
            razorpay_order_id: 'order_v1', razorpay_payment_id: 'pay_v1', razorpay_signature: sign('order_v1', 'pay_v1', SECRET),
        }, user);
        expect(r.subscription.plan_id).toBe('standard');
        expect(r.subscription.billing_cycle).toBe('yearly');
        expect(r.subscription.is_trial).toBe(false);
        expect(r.subscription.days_left).toBe(365);
        expect(r.payment.status).toBe('PAID');

        const again = await branchService.verifyPlanPayment(branch._id, {
            razorpay_order_id: 'order_v1', razorpay_payment_id: 'pay_v1', razorpay_signature: sign('order_v1', 'pay_v1', SECRET),
        }, user);
        expect(again.already_processed).toBe(true);
    });

    test('paid time stacks on top of an active paid plan', async () => {
        const { branch, user } = await makeStore();
        branch.subscription = { plan_id: 'basic', plan_name: 'Basic', billing_cycle: 'monthly', status: 'ACTIVE', start_date: new Date(), expiry_date: inDays(10) };
        await branch.save();
        await PlanPayment.create({ branch_id: branch._id, plan_id: 'basic', plan_name: 'Basic', billing_cycle: 'monthly', amount: 299, razorpay_order_id: 'order_s1' });
        const r = await branchService.verifyPlanPayment(branch._id, {
            razorpay_order_id: 'order_s1', razorpay_payment_id: 'pay_s1', razorpay_signature: sign('order_s1', 'pay_s1', SECRET),
        }, user);
        expect(r.subscription.days_left).toBe(40);
    });

    test('bad signature is rejected and the attempt marked FAILED', async () => {
        const { branch, user } = await makeStore();
        await PlanPayment.create({ branch_id: branch._id, plan_id: 'pro', plan_name: 'Pro', billing_cycle: 'monthly', amount: 699, razorpay_order_id: 'order_bad' });
        await expectApiError(branchService.verifyPlanPayment(branch._id, {
            razorpay_order_id: 'order_bad', razorpay_payment_id: 'pay_x', razorpay_signature: 'forged',
        }, user), 'PAYMENT_SIGNATURE_INVALID', 400);
        expect((await PlanPayment.findOne({ razorpay_order_id: 'order_bad' })).status).toBe('FAILED');
        expect((await Branch.findById(branch._id)).subscription.plan_id).toBe('trial');
    });

    test('an order from another branch cannot be verified here', async () => {
        const a = await makeStore();
        const b = await makeStore();
        await PlanPayment.create({ branch_id: a.branch._id, plan_id: 'basic', plan_name: 'Basic', billing_cycle: 'monthly', amount: 299, razorpay_order_id: 'order_a' });
        await expectApiError(branchService.verifyPlanPayment(b.branch._id, {
            razorpay_order_id: 'order_a', razorpay_payment_id: 'p', razorpay_signature: sign('order_a', 'p', SECRET),
        }, b.user), 'PAYMENT_NOT_FOUND', 404);
    });
});

describe('planGuard middleware', () => {
    const run = (req) =>
        new Promise((resolve) => {
            const res = {
                statusCode: 200,
                status(c) { this.statusCode = c; return this; },
                json(body) { resolve({ blocked: true, status: this.statusCode, body }); },
            };
            planGuard(req, res, (err) => resolve({ blocked: false, err }));
        });

    test('reads are always allowed', async () => {
        expect((await run({ method: 'GET', originalUrl: '/api/v1/inventory' })).blocked).toBe(false);
    });

    test('writes on an expired plan are blocked with PLAN_EXPIRED', async () => {
        process.env.PLAN_GRACE_DAYS = '0';
        const { branch } = await makeStore();
        branch.subscription.expiry_date = inDays(-2);
        await branch.save();
        const r = await run({ method: 'POST', originalUrl: '/api/v1/pos/invoices', user: { branchId: branch._id.toString() }, headers: {} });
        expect(r.blocked).toBe(true);
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('PLAN_EXPIRED');
    });

    test('plan recharge routes stay open when expired', async () => {
        const { branch } = await makeStore();
        branch.subscription.expiry_date = inDays(-2);
        await branch.save();
        const r = await run({ method: 'POST', originalUrl: '/api/v1/branch/plan/checkout', user: { branchId: branch._id.toString() }, headers: {} });
        expect(r.blocked).toBe(false);
    });

    test('writes on an active trial pass', async () => {
        const { branch } = await makeStore();
        const r = await run({ method: 'POST', originalUrl: '/api/v1/purchases', user: { branchId: branch._id.toString() }, headers: {} });
        expect(r.blocked).toBe(false);
        expect(r.err).toBeUndefined();
    });
});
