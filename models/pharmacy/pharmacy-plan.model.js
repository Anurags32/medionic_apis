const mongoose = require('mongoose');

/**
 * A paid plan pharmacies can buy, managed from the admin panel. Prices are
 * per store per month; the yearly price comes from PricingSettings.
 * The free trial is not stored here (see PricingSettings.trial_days).
 */
const pharmacyPlanSchema = new mongoose.Schema(
    {
        plan_id: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        tagline: { type: String, trim: true, default: '' },
        monthly_price: { type: Number, required: true, min: 0 },
        features: { type: [String], default: [] },
        popular: { type: Boolean, default: false },
        // Inactive plans are hidden from the catalog and cannot be bought;
        // stores already on them keep the plan until it expires.
        is_active: { type: Boolean, default: true },
        sort_order: { type: Number, default: 0 },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

module.exports = mongoose.model('PharmacyPlan', pharmacyPlanSchema);
