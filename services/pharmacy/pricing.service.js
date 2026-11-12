/**
 * Pharmacy plans & pricing, managed from the admin panel.
 *
 * Plans and platform settings live in MongoDB (PharmacyPlan, PricingSettings).
 * The first read seeds them from config/pharmacyPlans.js, so a fresh
 * database behaves exactly like the old hard-coded catalog.
 *
 * Price changes apply to new purchases only; a store's current plan and
 * expiry are never touched by editing a plan.
 */
const { Branch, PharmacyPlan, PricingSettings } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const defaults = require('../../config/pharmacyPlans');

const CYCLE_DAYS = { monthly: 30, yearly: 365 };
const PLAN_ID_RE = /^[a-z][a-z0-9-]{1,29}$/;

const defaultSettings = () => ({
    key: 'default',
    trial_days: defaults.TRIAL_DAYS,
    yearly_months_charged: defaults.YEARLY_MONTHS_CHARGED,
    onboarding_fee: 0,
    data_import_included: true,
});

/**
 * Copies the built-in plans into an empty database (idempotent). Plans are
 * never deleted (only deactivated), so this runs its insert only once.
 */
const ensureSeeded = async () => {
    if ((await PharmacyPlan.estimatedDocumentCount()) === 0) {
        const docs = defaults.PLANS.filter((p) => p.purchasable).map((p, i) => ({
            plan_id: p.id,
            name: p.name,
            tagline: p.tagline || '',
            monthly_price: p.monthly_price,
            features: p.features || [],
            popular: Boolean(p.popular),
            is_active: true,
            sort_order: (i + 1) * 10,
        }));
        try {
            await PharmacyPlan.insertMany(docs, { ordered: false });
        } catch (err) {
            // Another request seeded at the same time: duplicates are fine.
            const writeErrors = err.writeErrors || [];
            const onlyDuplicates = err.code === 11000 || (writeErrors.length > 0 && writeErrors.every((e) => e.code === 11000));
            if (!onlyDuplicates) throw err;
        }
    }
};

// Missing settings document = built-in defaults (written on first admin save).
const getSettings = async () => {
    await ensureSeeded();
    const doc = await PricingSettings.findOne({ key: 'default' }).lean();
    return { ...defaultSettings(), ...(doc || {}) };
};

const getCycle = (id, settings) => {
    const key = String(id || '').toLowerCase();
    if (key === 'monthly') return { id: 'monthly', label: 'Monthly', days: CYCLE_DAYS.monthly, months_charged: 1 };
    if (key === 'yearly') {
        return { id: 'yearly', label: 'Yearly', days: CYCLE_DAYS.yearly, months_charged: settings.yearly_months_charged };
    }
    return null;
};

const planAmount = (plan, cycle) => plan.monthly_price * cycle.months_charged;

const toCatalogPlan = (p, settings) => ({
    id: p.plan_id,
    name: p.name,
    tagline: p.tagline || '',
    monthly_price: p.monthly_price,
    yearly_price: p.monthly_price * settings.yearly_months_charged,
    yearly_savings: p.monthly_price * (12 - settings.yearly_months_charged),
    purchasable: true,
    popular: Boolean(p.popular),
    features: p.features || [],
});

const trialPlan = (settings) => ({
    id: 'trial',
    name: 'Free Trial',
    tagline: `${settings.trial_days} days free · no card needed`,
    monthly_price: 0,
    yearly_price: 0,
    yearly_savings: 0,
    purchasable: false,
    popular: false,
    trial_days: settings.trial_days,
    features: [
        'Everything in Standard for the trial period',
        ...(settings.data_import_included
            ? ['Free assisted data import — send us your Excel, we set up your stock']
            : []),
        settings.onboarding_fee > 0 ? `One-time onboarding fee ₹${settings.onboarding_fee}` : 'No onboarding fee',
    ],
});

/** Catalog for the pharmacy app (`GET /api/v1/branch/plans`): active plans only. */
const getCatalog = async () => {
    const settings = await getSettings();
    const plans = await PharmacyPlan.find({ is_active: true }).sort({ sort_order: 1, monthly_price: 1 }).lean();
    return {
        currency: 'INR',
        trial_days: settings.trial_days,
        onboarding_fee: settings.onboarding_fee,
        data_import_included: settings.data_import_included,
        yearly_months_charged: settings.yearly_months_charged,
        billing_cycles: [getCycle('monthly', settings), getCycle('yearly', settings)],
        plans: [trialPlan(settings), ...plans.map((p) => toCatalogPlan(p, settings))],
    };
};

/**
 * Plan + cycle + amount for a purchase. Owners can only buy active plans;
 * an admin recording an offline payment may also use an inactive one.
 */
const resolvePurchase = async (planId, cycleId, { allowInactive = false } = {}) => {
    const settings = await getSettings();
    const id = String(planId || '').toLowerCase();
    const plan = id && id !== 'trial' ? await PharmacyPlan.findOne({ plan_id: id }).lean() : null;
    if (!plan || (!plan.is_active && !allowInactive)) {
        throw new ApiError(400, 'Choose a valid paid plan', 'INVALID_PLAN');
    }
    const cycle = getCycle(cycleId || 'monthly', settings);
    if (!cycle) {
        throw new ApiError(400, 'billing_cycle must be monthly or yearly', 'INVALID_BILLING_CYCLE');
    }
    return { plan, cycle, amount: planAmount(plan, cycle), settings };
};

/** Subscription sub-document for a new (or newly approved) store. */
const trialSubscription = async () => {
    const settings = await getSettings();
    return Branch.trialSubscription(settings.trial_days);
};

// ─── Admin: plans ────────────────────────────────────────────────────────────

const listPlansForAdmin = async () => {
    const settings = await getSettings();
    const plans = await PharmacyPlan.find().sort({ sort_order: 1, monthly_price: 1 }).lean();
    const counts = await Branch.aggregate([
        { $match: { 'subscription.plan_id': { $in: plans.map((p) => p.plan_id) } } },
        { $group: { _id: '$subscription.plan_id', stores: { $sum: 1 } } },
    ]);
    const byPlan = Object.fromEntries(counts.map((c) => [c._id, c.stores]));
    return plans.map((p) => ({
        id: p._id,
        plan_id: p.plan_id,
        name: p.name,
        tagline: p.tagline,
        monthly_price: p.monthly_price,
        yearly_price: p.monthly_price * settings.yearly_months_charged,
        features: p.features,
        popular: p.popular,
        is_active: p.is_active,
        sort_order: p.sort_order,
        stores_on_plan: byPlan[p.plan_id] || 0,
        updated_at: p.updated_at,
    }));
};

const cleanFeatures = (features) => {
    const list = Array.isArray(features) ? features : String(features || '').split('\n');
    return list.map((f) => String(f).trim()).filter(Boolean).slice(0, 30);
};

const parsePrice = (value) => {
    const n = Number(value);
    // Razorpay's minimum charge is ₹1; whole rupees keep invoices simple.
    if (!Number.isFinite(n) || n < 1 || n > 1000000 || !Number.isInteger(n)) {
        throw new ApiError(400, 'Monthly price must be a whole number of rupees, at least ₹1', 'INVALID_PRICE');
    }
    return n;
};

/** Only one plan carries the "Most popular" badge. */
const clearOtherPopular = (planId) =>
    PharmacyPlan.updateMany({ plan_id: { $ne: planId }, popular: true }, { $set: { popular: false } });

const createPlan = async (payload = {}) => {
    await ensureSeeded();
    const planId = String(payload.plan_id || '').trim().toLowerCase();
    if (!PLAN_ID_RE.test(planId) || planId === 'trial') {
        throw new ApiError(400, 'Plan code must be 2-30 characters: lowercase letters, numbers, dashes (not "trial")', 'INVALID_PLAN_ID');
    }
    const name = String(payload.name || '').trim();
    if (!name) throw new ApiError(400, 'Plan name is required', 'PLAN_NAME_REQUIRED');
    if (await PharmacyPlan.exists({ plan_id: planId })) {
        throw new ApiError(409, `A plan with code '${planId}' already exists`, 'PLAN_EXISTS');
    }
    const last = await PharmacyPlan.findOne().sort({ sort_order: -1 }).lean();
    const plan = await PharmacyPlan.create({
        plan_id: planId,
        name,
        tagline: String(payload.tagline || '').trim(),
        monthly_price: parsePrice(payload.monthly_price),
        features: cleanFeatures(payload.features),
        popular: payload.popular === true,
        is_active: payload.is_active !== false,
        sort_order: Number.isFinite(Number(payload.sort_order)) && payload.sort_order !== '' && payload.sort_order != null
            ? Number(payload.sort_order)
            : (last ? last.sort_order + 10 : 10),
    });
    if (plan.popular) await clearOtherPopular(plan.plan_id);
    return plan;
};

const updatePlan = async (planId, payload = {}) => {
    await ensureSeeded();
    const plan = await PharmacyPlan.findOne({ plan_id: String(planId || '').toLowerCase() });
    if (!plan) throw new ApiError(404, 'Plan not found', 'PLAN_NOT_FOUND');

    if (payload.name !== undefined) {
        const name = String(payload.name).trim();
        if (!name) throw new ApiError(400, 'Plan name is required', 'PLAN_NAME_REQUIRED');
        plan.name = name;
    }
    if (payload.tagline !== undefined) plan.tagline = String(payload.tagline || '').trim();
    if (payload.monthly_price !== undefined) plan.monthly_price = parsePrice(payload.monthly_price);
    if (payload.features !== undefined) plan.features = cleanFeatures(payload.features);
    if (payload.popular !== undefined) plan.popular = payload.popular === true;
    if (payload.is_active !== undefined) plan.is_active = payload.is_active === true;
    if (payload.sort_order !== undefined && Number.isFinite(Number(payload.sort_order))) {
        plan.sort_order = Number(payload.sort_order);
    }
    if (!plan.is_active) plan.popular = false;

    if (plan.is_active === false) {
        const othersActive = await PharmacyPlan.countDocuments({ plan_id: { $ne: plan.plan_id }, is_active: true });
        if (othersActive === 0) {
            throw new ApiError(400, 'At least one plan must stay active so stores can renew', 'LAST_ACTIVE_PLAN');
        }
    }
    await plan.save();
    if (plan.popular) await clearOtherPopular(plan.plan_id);
    return plan;
};

// ─── Admin: platform settings ────────────────────────────────────────────────

const intInRange = (value, min, max, label, code) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) {
        throw new ApiError(400, `${label} must be a whole number from ${min} to ${max}`, code);
    }
    return n;
};

const updateSettings = async (payload = {}, actorName = '') => {
    const current = await getSettings();
    const next = {};
    if (payload.trial_days !== undefined) {
        next.trial_days = intInRange(payload.trial_days, 1, 90, 'Trial days', 'INVALID_TRIAL_DAYS');
    }
    if (payload.yearly_months_charged !== undefined) {
        next.yearly_months_charged = intInRange(payload.yearly_months_charged, 1, 12, 'Months charged for a yearly plan', 'INVALID_YEARLY_MONTHS');
    }
    if (payload.onboarding_fee !== undefined) {
        next.onboarding_fee = intInRange(payload.onboarding_fee, 0, 1000000, 'Onboarding fee', 'INVALID_ONBOARDING_FEE');
    }
    if (payload.data_import_included !== undefined) {
        next.data_import_included = payload.data_import_included === true;
    }
    next.updated_by_name = actorName;
    await PricingSettings.updateOne({ key: 'default' }, { $set: next }, { upsert: true });
    return { ...current, ...next };
};

module.exports = {
    CYCLE_DAYS,
    ensureSeeded,
    getSettings,
    getCycle,
    planAmount,
    getCatalog,
    resolvePurchase,
    trialSubscription,
    listPlansForAdmin,
    createPlan,
    updatePlan,
    updateSettings,
};
