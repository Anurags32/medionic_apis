const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        address: {
            type: String,
            trim: true,
        },
        loyalty_points: {
            type: Number,
            default: 0,
        },
        khata_balance: {
            type: Number,
            default: 0,
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
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
        toObject: {
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

customerSchema.index({ branch_id: 1, phone: 1 });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
