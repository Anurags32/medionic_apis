const mongoose = require('mongoose');

/** Platform-wide pricing knobs (single document, key 'default'). */
const pricingSettingsSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'default', unique: true },
        trial_days: { type: Number, min: 1, max: 90, default: 14 },
        // Months billed for a 12-month (yearly) plan: 10 = "2 months free".
        yearly_months_charged: { type: Number, min: 1, max: 12, default: 10 },
        onboarding_fee: { type: Number, min: 0, default: 0 },
        data_import_included: { type: Boolean, default: true },
        updated_by_name: { type: String, default: '' },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        toJSON: {
            transform: (doc, ret) => {
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

module.exports = mongoose.model('PricingSettings', pricingSettingsSchema);
