const mongoose = require('mongoose');
const { PAYMENT_MODES, PAYMENT_STATUS } = require('../../config/pharmacyConstants');
const { invoiceItemSchema } = require('./invoice-item.model');


const invoiceSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            default: null,
            index: true,
        },
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            default: null,
            index: true,
        },
        invoice_number: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        invoice_date: {
            type: Date,
            default: Date.now,
            index: true,
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
        total_tax: {
            type: Number,
            default: 0,
        },
        cgst_amount: {
            type: Number,
            default: 0,
        },
        sgst_amount: {
            type: Number,
            default: 0,
        },
        igst_amount: {
            type: Number,
            default: 0,
        },
        grand_total: {
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
            default: PAYMENT_STATUS.COMPLETED,
        },
        created_by_user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        items: [invoiceItemSchema],
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

invoiceSchema.virtual('customer', {
    ref: 'Customer',
    localField: 'customer_id',
    foreignField: '_id',
    justOne: true,
});

invoiceSchema.virtual('order', {
    ref: 'Order',
    localField: 'order_id',
    foreignField: '_id',
    justOne: true,
});

invoiceSchema.virtual('created_by', {
    ref: 'PharmacyStaff',
    localField: 'created_by_user_id',
    foreignField: '_id',
    justOne: true,
});


invoiceSchema.virtual('branch', {
    ref: 'Branch',
    localField: 'branch_id',
    foreignField: '_id',
    justOne: true,
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
