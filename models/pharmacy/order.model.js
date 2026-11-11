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
        // Delivery Integration fields
        fulfillment_type: {
            type: String,
            enum: ['STORE_PICKUP', 'HOME_DELIVERY'],
            default: 'HOME_DELIVERY',
        },
        delivery_required: {
            type: Boolean,
            default: false,
            index: true,
        },
        delivery_mode: {
            type: String,
            enum: ['PLATFORM', 'OWN_STAFF', 'BOTH', null],
            default: null,
        },
        delivery_status: {
            type: String,
            enum: [
                'PENDING',
                'OFFERED',
                'ASSIGNED',
                'REACHED_PHARMACY',
                'PICKED_UP',
                'OUT_FOR_DELIVERY',
                'REACHED_CUSTOMER',
                'DELIVERED',
                'FAILED',
                'RETURNED',
                'CANCELLED',
                null,
            ],
            default: null,
            index: true,
        },
        assigned_partner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryPartner',
            default: null,
            index: true,
        },
        delivery_assignment_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryAssignment',
            default: null,
        },
        pickup_location: {
            address: { type: String, trim: true },
            location: {
                type: { type: String, enum: ['Point'], default: 'Point' },
                coordinates: { type: [Number], default: [0, 0] },
            },
        },
        drop_location: {
            address: { type: String, trim: true },
            city: { type: String, trim: true },
            pincode: { type: String, trim: true },
            location: {
                type: { type: String, enum: ['Point'], default: 'Point' },
                coordinates: { type: [Number], default: [0, 0] },
            },
        },
        delivery_charges: {
            type: Number,
            default: 0,
            min: 0,
        },
        estimated_delivery_time: {
            type: Date,
            default: null,
        },
        delivered_at: {
            type: Date,
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

orderSchema.virtual('assigned_partner', {
    ref: 'DeliveryPartner',
    localField: 'assigned_partner_id',
    foreignField: '_id',
    justOne: true,
});

orderSchema.virtual('delivery_assignment', {
    ref: 'DeliveryAssignment',
    localField: 'delivery_assignment_id',
    foreignField: '_id',
    justOne: true,
});

orderSchema.index({ branch_id: 1, status: 1, created_at: -1 });
orderSchema.index({ branch_id: 1, order_type: 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
