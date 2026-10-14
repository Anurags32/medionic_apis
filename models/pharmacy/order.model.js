const mongoose = require('mongoose');
const { ORDER_STATUS, ORDER_TYPES, PAYMENT_MODES, PAYMENT_STATUS } = require('../../config/pharmacyConstants');
const { orderItemSchema } = require('./order-item.model');


const orderSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            default: null,
            index: true,
        },
        prescription_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Prescription',
            default: null,
        },
        order_number: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        order_type: {
            type: String,
            enum: Object.values(ORDER_TYPES),
            default: ORDER_TYPES.COUNTER,
        },
        status: {
            type: String,
            enum: Object.values(ORDER_STATUS),
            default: ORDER_STATUS.PLACED,
            index: true,
        },
        delivery_address: {
            type: String,
            trim: true,
        },
        delivery_phone: {
            type: String,
            trim: true,
        },
        delivery_pincode: {
            type: String,
            trim: true,
        },
        subtotal: {
            type: Number,
            required: true,
            default: 0,
        },
        discount_amount: {
            type: Number,
            default: 0,
        },
        tax_amount: {
            type: Number,
            default: 0,
        },
        net_amount: {
            type: Number,
            required: true,
            default: 0,
        },
        payment_mode: {
            type: String,
            enum: Object.values(PAYMENT_MODES),
            default: PAYMENT_MODES.CASH,
        },
        payment_status: {
            type: String,
            enum: Object.values(PAYMENT_STATUS),
            default: PAYMENT_STATUS.PENDING,
        },
        assigned_packer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        created_by_user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        remarks: {
            type: String,
            trim: true,
        },
        items: [orderItemSchema],
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

orderSchema.virtual('customer', {
    ref: 'Customer',
    localField: 'customer_id',
    foreignField: '_id',
    justOne: true,
});

orderSchema.virtual('prescription', {
    ref: 'PharmacyPrescription',
    localField: 'prescription_id',
    foreignField: '_id',
    justOne: true,
});

orderSchema.virtual('assigned_packer', {
    ref: 'PharmacyStaff',
    localField: 'assigned_packer_id',
    foreignField: '_id',
    justOne: true,
});

orderSchema.virtual('created_by', {
    ref: 'PharmacyStaff',
    localField: 'created_by_user_id',
    foreignField: '_id',
    justOne: true,
});

orderSchema.index({ branch_id: 1, status: 1, created_at: -1 });
orderSchema.index({ branch_id: 1, order_type: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
