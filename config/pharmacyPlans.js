/**
 * Pharmacy subscription catalog (per branch).
 *
 * - Every new branch starts on a free 14-day trial, no card required.
 * - Paid plans are priced per branch per month; the yearly cycle bills 10
 *   months (2 months free).
 * - No onboarding fee; data import (Excel/CSV → inventory) is included.
 *
 * Amounts are in INR (rupees). Razorpay amounts are derived from these on the
 * server so the client can never choose its own price.
 */

const TRIAL_DAYS = parseInt(process.env.PLAN_TRIAL_DAYS || '14', 10);
const YEARLY_MONTHS_CHARGED = 10; // 12 months of access, 2 free

const BILLING_CYCLES = {
    monthly: { id: 'monthly', label: 'Monthly', days: 30, months_charged: 1 },
    yearly: { id: 'yearly', label: 'Yearly', days: 365, months_charged: YEARLY_MONTHS_CHARGED },
};

const PLANS = [
    {
        id: 'trial',
        name: 'Free Trial',
        tagline: `${TRIAL_DAYS} days free · no card needed`,
        monthly_price: 0,
        purchasable: false,
        trial_days: TRIAL_DAYS,
        features: [
            'Everything in Standard for the trial period',
            'Free assisted data import — send us your Excel, we set up your stock',
            'No onboarding fee',
        ],
    },
    {
        id: 'basic',
        name: 'Basic',
        tagline: 'Single store counter setup',
        monthly_price: 299,
        purchasable: true,
        features: [
            'Standard POS walk-in billing',
            'Basic inventory & stock ledger',
            'Up to 3 staff logins with role permissions',
            'Daily & weekly sales summaries',
            'Standard email & ticket support',
        ],
    },
    {
        id: 'standard',
        name: 'Standard',
        tagline: 'For busy single-store pharmacies',
        monthly_price: 499,
        purchasable: true,
        popular: true,
        features: [
            'POS billing with barcode scanner',
            'Batch-wise inventory & expiry alerts (30/60/90 days)',
            'Customer khata / ledger & WhatsApp reminders',
            'Online order queue with picking & packing',
            'GST tax reports & exports',
            'Unlimited staff users',
        ],
    },
    {
        id: 'pro',
        name: 'Pro Enterprise',
        tagline: 'Multi-store & unlimited branches',
        monthly_price: 699,
        purchasable: true,
        features: [
            'Unlimited stores, branches & warehouse hubs',
            'Staff attendance & live GPS duty radar',
            'Consolidated multi-branch analytics',
            'Custom invoice branding with logo & QR',
            'Unlimited users with granular role security',
            'Priority phone & WhatsApp support',
        ],
    },
];

const getPlan = (id) => PLANS.find((p) => p.id === String(id || '').toLowerCase()) || null;
const getCycle = (id) => BILLING_CYCLES[String(id || '').toLowerCase()] || null;

/** Rupees charged for one plan on one billing cycle. */
const planAmount = (plan, cycle) => plan.monthly_price * cycle.months_charged;

/** Catalog as sent to clients (prices for both cycles pre-computed). */
const planCatalog = () => ({
    currency: 'INR',
    trial_days: TRIAL_DAYS,
    onboarding_fee: 0,
    data_import_included: true,
    yearly_months_charged: YEARLY_MONTHS_CHARGED,
    billing_cycles: Object.values(BILLING_CYCLES),
    plans: PLANS.map((p) => ({
        ...p,
        yearly_price: p.monthly_price * YEARLY_MONTHS_CHARGED,
        yearly_savings: p.monthly_price * (12 - YEARLY_MONTHS_CHARGED),
    })),
});

module.exports = {
    TRIAL_DAYS,
    YEARLY_MONTHS_CHARGED,
    BILLING_CYCLES,
    PLANS,
    getPlan,
    getCycle,
    planAmount,
    planCatalog,
};
