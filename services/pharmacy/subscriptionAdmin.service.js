/**
 * Admin-side store subscription management: list every store's plan,
 * extend a trial, and activate a plan paid offline (cash / UPI / bank /
 * cheque) or given free. Every change is written to SubscriptionEvent and
 * offline payments to PlanPayment (source ADMIN), so nothing changes silently.
 */
const { Branch, User, PlanPayment, SubscriptionEvent } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { emitToBranch } = require('../../socket/pharmacyEvents');
const pricing = require('./pricing.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'COMPLIMENTARY'];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findBranch = async (branchId) => {
    const branch = await Branch.findById(branchId).catch(() => null);
    if (!branch) throw new ApiError(404, 'Store not found', 'BRANCH_NOT_FOUND');
    return branch;
};

const notifyStore = (branch) => {
    const subscription = branch.getSubscriptionDetails();
    emitToBranch(branch._id.toString(), 'branch:plan_updated', { branchId: branch._id.toString(), subscription });
    return subscription;
};

const IST_OFFSET_MS = 330 * 60 * 1000; // India: UTC+5:30, no daylight saving

/** First instant of the current calendar month in India, whatever the server's time zone. */
const istMonthStart = (now = new Date()) => {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
};

const TRIAL_PLAN = { 'subscription.plan_id': { $in: ['trial', null] } };

/**
 * Stores whose owner is not approved (pending or rejected). Same rule as
 * login: anything other than 'approved' cannot use the app. A trial on such
 * a store has not really started (approval restarts it), so these stores
 * are counted as "awaiting approval", never as active/expiring/expired.
 */
const unapprovedBranchIds = async () => {
    const owners = await User.find({ role: 'PHARMACY_OWNER', approval_status: { $ne: 'approved' } })
        .select('_id branch_id')
        .lean();
    if (!owners.length) return [];
    const branches = await Branch.find({
        $or: [
            { owner_id: { $in: owners.map((o) => o._id) } },
            { _id: { $in: owners.map((o) => o.branch_id).filter(Boolean) } },
        ],
    }).select('_id').lean();
    return branches.map((b) => b._id);
};

const awaitingFilter = (unapproved) => ({ _id: { $in: unapproved }, ...TRIAL_PLAN });
const notAwaitingFilter = (unapproved) => (unapproved.length ? { $nor: [awaitingFilter(unapproved)] } : {});

/**
 * Mongo filter for a computed subscription status (see getSubscriptionDetails).
 * Every store falls in exactly one of: awaiting, active, expiring, expired.
 */
const statusFilter = (status, unapproved, now = new Date()) => {
    const soon = new Date(now.getTime() + 7 * DAY_MS);
    const live = (expiry) => ({ $and: [{ 'subscription.expiry_date': expiry }, notAwaitingFilter(unapproved)] });
    switch (status) {
        case 'awaiting': return awaitingFilter(unapproved);
        case 'active': return live({ $gt: soon });
        case 'expiring': return live({ $gt: now, $lte: soon });
        case 'expired': return live({ $lte: now });
        default: return {};
    }
};

const planFilter = (plan) => {
    if (!plan || plan === 'all') return {};
    if (plan === 'trial') return { $or: [{ 'subscription.plan_id': 'trial' }, { 'subscription.plan_id': { $exists: false } }] };
    if (plan === 'paid') return { 'subscription.plan_id': { $nin: ['trial', null] } };
    return { 'subscription.plan_id': String(plan).toLowerCase() };
};

const listSubscriptions = async (query = {}) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const now = new Date();
    const unapproved = await unapprovedBranchIds();
    const unapprovedSet = new Set(unapproved.map(String));

    const and = [statusFilter(query.status, unapproved, now), planFilter(query.plan)];
    const search = String(query.search || '').trim();
    if (search) {
        const re = new RegExp(escapeRegex(search), 'i');
        const owners = await User.find({ role: 'PHARMACY_OWNER', $or: [{ full_name: re }, { email: re }, { phone: re }] })
            .select('branch_id')
            .lean();
        and.push({
            $or: [
                { name: re }, { code: re }, { city: re }, { gstin: re }, { drug_license_no: re },
                { contact_number: re }, { email: re },
                { _id: { $in: owners.map((o) => o.branch_id).filter(Boolean) } },
            ],
        });
    }
    const filter = { $and: and.filter((f) => Object.keys(f).length) };
    if (!filter.$and.length) delete filter.$and;

    const sort = query.sort === 'expiry' ? { 'subscription.expiry_date': 1 } : { created_at: -1 };
    const [branches, total] = await Promise.all([
        Branch.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
        Branch.countDocuments(filter),
    ]);

    const ids = branches.map((b) => b._id);
    const [owners, lastPayments] = await Promise.all([
        User.find({ role: 'PHARMACY_OWNER', $or: [{ _id: { $in: branches.map((b) => b.owner_id).filter(Boolean) } }, { branch_id: { $in: ids } }] })
            .select('full_name email phone approval_status branch_id')
            .lean(),
        PlanPayment.aggregate([
            { $match: { branch_id: { $in: ids }, status: 'PAID' } },
            { $sort: { paid_at: -1 } },
            { $group: { _id: '$branch_id', amount: { $first: '$amount' }, paid_at: { $first: '$paid_at' }, source: { $first: '$source' }, plan_name: { $first: '$plan_name' } } },
        ]),
    ]);
    const ownerOf = (b) => owners.find((o) => (b.owner_id && o._id.equals(b.owner_id))) || owners.find((o) => o.branch_id && o.branch_id.equals(b._id));
    const paymentOf = Object.fromEntries(lastPayments.map((p) => [p._id.toString(), p]));

    const stores = branches.map((b) => {
        const owner = ownerOf(b);
        const last = paymentOf[b._id.toString()];
        const subscription = b.getSubscriptionDetails();
        return {
            id: b._id,
            name: b.name,
            code: b.code,
            city: b.city || b.extractCityFromAddress(),
            contact_number: b.contact_number,
            email: b.email,
            is_active: b.is_active,
            created_at: b.created_at,
            owner: owner
                ? { id: owner._id, name: owner.full_name, email: owner.email, phone: owner.phone, approval_status: owner.approval_status }
                : null,
            subscription,
            awaiting_approval: subscription.is_trial && unapprovedSet.has(b._id.toString()),
            last_payment: last
                ? { amount: last.amount, paid_at: last.paid_at, source: last.source || 'RAZORPAY', plan_name: last.plan_name }
                : null,
        };
    });

    const monthStart = istMonthStart(now);
    const [all, onTrial, awaiting, expiring, expired, revenue] = await Promise.all([
        Branch.countDocuments({}),
        Branch.countDocuments(planFilter('trial')),
        unapproved.length ? Branch.countDocuments(awaitingFilter(unapproved)) : 0,
        Branch.countDocuments(statusFilter('expiring', unapproved, now)),
        Branch.countDocuments(statusFilter('expired', unapproved, now)),
        PlanPayment.aggregate([
            { $match: { status: 'PAID', paid_at: { $gte: monthStart } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
    ]);

    return {
        stores,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        summary: {
            total_stores: all,
            on_trial: onTrial, // includes stores awaiting approval
            awaiting_approval: awaiting,
            on_paid_plan: all - onTrial,
            expiring_in_7_days: expiring,
            expired: expired,
            revenue_this_month: revenue[0]?.total || 0,
            payments_this_month: revenue[0]?.count || 0,
            month_start: monthStart,
        },
    };
};

const recordEvent = (branch, type, fields, actor) =>
    SubscriptionEvent.create({
        branch_id: branch._id,
        type,
        actor_name: actor?.name || '',
        actor_id: actor?.id ? String(actor.id) : '',
        ...fields,
    });

/** Adds free days to a store that is on the trial. */
const extendTrial = async (branchId, payload = {}, actor = null) => {
    const days = Number(payload.days);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
        throw new ApiError(400, 'Days must be a whole number from 1 to 90', 'INVALID_DAYS');
    }
    const branch = await findBranch(branchId);
    const planId = branch.subscription?.plan_id || 'trial';
    if (planId !== 'trial') {
        throw new ApiError(409, 'This store is on a paid plan. Use "Activate plan" to add paid time.', 'NOT_ON_TRIAL');
    }
    if ((await unapprovedBranchIds()).some((id) => id.equals(branch._id))) {
        throw new ApiError(409, 'This store is not approved yet. Its trial starts when you approve it.', 'AWAITING_APPROVAL');
    }

    const now = new Date();
    const previous = branch.subscription?.expiry_date ? new Date(branch.subscription.expiry_date) : now;
    const base = previous > now ? previous : now;
    const newExpiry = new Date(base.getTime() + days * DAY_MS);
    const settings = await pricing.getSettings();

    branch.subscription.plan_id = 'trial';
    branch.subscription.plan_name = branch.subscription.plan_name || 'Free Trial';
    branch.subscription.billing_cycle = 'trial';
    branch.subscription.trial_days = (branch.subscription.trial_days || settings.trial_days) + days;
    branch.subscription.status = 'ACTIVE';
    branch.subscription.expiry_date = newExpiry;
    await branch.save();

    await recordEvent(branch, 'TRIAL_EXTENDED', {
        plan_id: 'trial',
        plan_name: 'Free Trial',
        days,
        note: String(payload.note || '').trim(),
        previous_expiry: previous,
        new_expiry: newExpiry,
    }, actor);

    return notifyStore(branch);
};

/**
 * Puts a store on a paid plan after an offline payment (or for free).
 * Paid time stacks on remaining paid time; trial days are not carried over
 * (same rule as an online Razorpay recharge).
 */
const activatePlan = async (branchId, payload = {}, actor = null) => {
    const mode = String(payload.payment_mode || '').toUpperCase();
    if (!PAYMENT_MODES.includes(mode)) {
        throw new ApiError(400, `Payment mode must be one of ${PAYMENT_MODES.join(', ')}`, 'INVALID_PAYMENT_MODE');
    }
    const { plan, cycle, amount: listPrice } = await pricing.resolvePurchase(payload.plan_id, payload.billing_cycle, { allowInactive: true });
    const branch = await findBranch(branchId);

    let amount = listPrice;
    if (mode === 'COMPLIMENTARY') {
        amount = 0;
    } else if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
        amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount < 0 || amount > 10000000) {
            throw new ApiError(400, 'Amount received must be zero or more', 'INVALID_AMOUNT');
        }
        amount = Math.round(amount * 100) / 100;
    }
    const note = String(payload.note || '').trim();
    if (amount !== listPrice && !note) {
        throw new ApiError(400, `Add a note explaining why ₹${amount} was charged instead of ₹${listPrice}`, 'NOTE_REQUIRED');
    }

    const now = new Date();
    const previous = branch.subscription?.expiry_date ? new Date(branch.subscription.expiry_date) : now;
    const onPaid = (branch.subscription?.plan_id || 'trial') !== 'trial';
    const base = onPaid && previous > now ? previous : now;
    const newExpiry = new Date(base.getTime() + cycle.days * DAY_MS);

    branch.subscription = {
        plan_id: plan.plan_id,
        plan_name: plan.name,
        billing_cycle: cycle.id,
        trial_days: branch.subscription?.trial_days || null,
        status: 'ACTIVE',
        start_date: branch.subscription?.plan_id === plan.plan_id && branch.subscription?.start_date ? branch.subscription.start_date : now,
        expiry_date: newExpiry,
        auto_renew: false,
    };
    await branch.save();

    const reference = String(payload.reference || '').trim();
    const payment = await PlanPayment.create({
        branch_id: branch._id,
        created_by: null,
        plan_id: plan.plan_id,
        plan_name: plan.name,
        billing_cycle: cycle.id,
        amount,
        currency: 'INR',
        status: 'PAID',
        source: 'ADMIN',
        payment_mode: mode,
        reference,
        note,
        recorded_by_name: actor?.name || '',
        period_start: base,
        period_end: newExpiry,
        paid_at: now,
    });

    await recordEvent(branch, 'PLAN_ACTIVATED', {
        plan_id: plan.plan_id,
        plan_name: plan.name,
        billing_cycle: cycle.id,
        days: cycle.days,
        amount,
        payment_mode: mode,
        reference,
        note,
        previous_expiry: previous,
        new_expiry: newExpiry,
    }, actor);

    return { subscription: notifyStore(branch), payment };
};

const getHistory = async (branchId) => {
    const branch = await findBranch(branchId);
    const [events, payments] = await Promise.all([
        SubscriptionEvent.find({ branch_id: branch._id }).sort({ created_at: -1 }).limit(100),
        PlanPayment.find({ branch_id: branch._id, status: 'PAID' }).sort({ paid_at: -1 }).limit(100),
    ]);
    return {
        store: { id: branch._id, name: branch.name, code: branch.code },
        subscription: branch.getSubscriptionDetails(),
        events,
        payments,
    };
};

module.exports = {
    PAYMENT_MODES,
    istMonthStart,
    listSubscriptions,
    extendTrial,
    activatePlan,
    getHistory,
    recordEvent,
};
