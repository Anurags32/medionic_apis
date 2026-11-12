const mongoose = require('mongoose');

/** Audit trail of every change to a store's plan (who, when, what, why). */
const subscriptionEventSchema = new mongoose.Schema(
    {
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
        type: {
            type: String,
            enum: ['TRIAL_STARTED', 'TRIAL_EXTENDED', 'PLAN_ACTIVATED', 'PLAN_PAID_ONLINE'],
            required: true,
        },
        plan_id: { type: String, default: '' },
        plan_name: { type: String, default: '' },
        billing_cycle: { type: String, default: '' },
        days: { type: Number, default: 0 },
        amount: { type: Number, default: 0 },
        payment_mode: { type: String, default: '' },
        reference: { type: String, default: '' },
        note: { type: String, default: '' },
        previous_expiry: { type: Date, default: null },
        new_expiry: { type: Date, default: null },
        actor_name: { type: String, default: '' },
        actor_id: { type: String, default: '' },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
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

subscriptionEventSchema.index({ branch_id: 1, created_at: -1 });

module.exports = mongoose.model('SubscriptionEvent', subscriptionEventSchema);
