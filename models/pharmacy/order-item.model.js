const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
    {
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
        },
        medicine_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: true,
        },
        batch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MedicineBatch',
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        unit_price: {
            type: Number,
            required: true,
        },
        mrp: {
            type: Number,
            required: true,
        },
        gst_rate: {
            type: Number,
            default: 0,
        },
        gst_amount: {
            type: Number,
            default: 0,
        },
        discount_amount: {
            type: Number,
            default: 0,
        },
        total_amount: {
            type: Number,
            required: true,
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

orderItemSchema.virtual('medicine', {
    ref: 'Medicine',
    localField: 'medicine_id',
    foreignField: '_id',
    justOne: true,
});

orderItemSchema.virtual('batch', {
    ref: 'MedicineBatch',
    localField: 'batch_id',
    foreignField: '_id',
    justOne: true,
});

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

module.exports = { OrderItem, orderItemSchema };
