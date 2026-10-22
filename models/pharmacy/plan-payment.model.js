const mongoose = require('mongoose');

/**
 * One plan recharge attempt (Razorpay order) for a branch. Created at
 * checkout, marked PAID only after the signature is verified server-side.
 */
const planPaymentSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        plan_id: {
            type: String,
            required: true,
        },
        plan_name: {
            type: String,
            required: true,
        },
        billing_cycle: {
            type: String,
            enum: ['monthly', 'yearly'],
            required: true,
        },
        amount: {
            type: Number, // rupees
            required: true,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        status: {
            type: String,
            enum: ['CREATED', 'PAID', 'FAILED'],
            default: 'CREATED',
            index: true,
        },
        razorpay_order_id: {
            type: String,
            index: true,
        },
        razorpay_payment_id: {
            type: String,
            default: null,
        },
        period_start: {
            type: Date,
            default: null,
        },
        period_end: {
            type: Date,
            default: null,
        },
        paid_at: {
            type: Date,
            default: null,
        },
        failure_reason: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }
);

planPaymentSchema.methods.toJSON = function () {
    const obj = this.toObject();
    obj.id = obj._id;
    delete obj._id;
    delete obj.__v;
    return obj;
};

module.exports = mongoose.model('PlanPayment', planPaymentSchema);
