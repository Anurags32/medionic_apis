const mongoose = require('mongoose');
const { TRIAL_DAYS } = require('../../config/pharmacyPlans');

const branchSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        drug_license_no: {
            type: String,
            required: true,
            trim: true,
        },
        gstin: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        contact_number: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        owner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        is_available: {
            type: Boolean,
            default: true,
        },
        pincode: {
            type: String,
            trim: true,
        },
        city: {
            type: String,
            trim: true,
            default: '',
        },
        subscription: {
            // Catalog id from config/pharmacyPlans.js ('trial' | 'basic' | 'standard' | 'pro')
            plan_id: {
                type: String,
                default: 'trial',
            },
            plan_name: {
                type: String,
                default: 'Free Trial',
            },
            billing_cycle: {
                type: String,
                enum: ['trial', 'monthly', 'yearly'],
                default: 'trial',
            },
            status: {
                type: String,
                enum: ['ACTIVE', 'EXPIRING_SOON', 'GRACE', 'EXPIRED'],
                default: 'ACTIVE',
            },
            start_date: {
                type: Date,
                default: Date.now,
            },
            // New branches start on the free trial (no card); see trialSubscription().
            expiry_date: {
                type: Date,
                default: () => new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
            },
            auto_renew: {
                type: Boolean,
                default: false,
            },
        },
        latitude: {
            type: Number,
            default: null,
        },
        longitude: {
            type: Number,
            default: null,
        },
        is_active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id;
                ret.store_name = ret.name;
                ret.storeName = ret.name;
                ret.city = ret.city || extractCityFromAddress(ret.address);
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
        toObject: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id;
                ret.store_name = ret.name;
                ret.storeName = ret.name;
                ret.city = ret.city || extractCityFromAddress(ret.address);
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

function extractCityFromAddress(address) {
    if (!address || typeof address !== 'string') return '';
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            if (!/\d{6}/.test(p) && !/^(UP|MP|DL|MH|KA|TN|GJ|RJ|HR|PB|WB|AP|TS|BR|JH|UK|HP|JK|OD|KL|AS|GA)($|\s)/i.test(p)) {
                return p;
            }
        }
        return parts[parts.length - 2] || parts[0];
    }
    return parts[0] || '';
}

branchSchema.methods.extractCityFromAddress = function () {
    return this.city || extractCityFromAddress(this.address);
};

branchSchema.methods.getSubscriptionDetails = function () {
    const now = new Date();
    const expiry = this.subscription?.expiry_date
        ? new Date(this.subscription.expiry_date)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const graceDays = parseInt(process.env.PLAN_GRACE_DAYS || '0', 10);
    const graceExpiry = new Date(expiry.getTime() + graceDays * 24 * 60 * 60 * 1000);

    const diffMs = expiry.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const graceDiffMs = graceExpiry.getTime() - now.getTime();
    const graceDaysLeft = now > expiry && now < graceExpiry
        ? Math.max(0, Math.ceil(graceDiffMs / (1000 * 60 * 60 * 24)))
        : (now <= expiry ? graceDays : 0);

    let status = 'ACTIVE';
    if (now >= graceExpiry) {
        status = 'EXPIRED';
    } else if (now >= expiry) {
        status = 'GRACE';
    } else if (daysLeft <= 7) {
        status = 'EXPIRING_SOON';
    }

    const isReadOnly = status === 'EXPIRED';
    const planId = this.subscription?.plan_id || 'trial';
    const isTrial = planId === 'trial';

    return {
        plan: this.subscription?.plan_name || 'Free Trial',
        plan_name: this.subscription?.plan_name || 'Free Trial',
        plan_id: planId,
        billing_cycle: this.subscription?.billing_cycle || (isTrial ? 'trial' : 'monthly'),
        is_trial: isTrial,
        isTrial,
        trial_days: TRIAL_DAYS,
        start_date: this.subscription?.start_date ? new Date(this.subscription.start_date).toISOString() : null,
        status,
        expiryDate: expiry.toISOString(),
        expiry_date: expiry.toISOString(),
        daysLeft,
        days_left: daysLeft,
        graceDaysLeft,
        grace_days_left: graceDaysLeft,
        isReadOnly,
        is_read_only: isReadOnly,
        isExpired: isReadOnly,
        is_expired: isReadOnly,
    };
};

/** Subscription sub-document for a brand-new branch: free 14-day trial. */
branchSchema.statics.trialSubscription = function () {
    const now = new Date();
    return {
        plan_id: 'trial',
        plan_name: 'Free Trial',
        billing_cycle: 'trial',
        status: 'ACTIVE',
        start_date: now,
        expiry_date: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        auto_renew: false,
    };
};

branchSchema.index({ owner_id: 1, is_active: 1 });
branchSchema.index({ gstin: 1 });

branchSchema.virtual('staff', {
    ref: 'PharmacyStaff',
    localField: '_id',
    foreignField: 'branch_id',
});

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch;