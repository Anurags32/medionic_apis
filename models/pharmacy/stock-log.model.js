const mongoose = require('mongoose');
const { STOCK_TRANSACTION_TYPES } = require('../../config/pharmacyConstants');


const stockLogSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        medicine_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Medicine',
            required: true,
            index: true,
        },
        batch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MedicineBatch',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: Object.values(STOCK_TRANSACTION_TYPES),
            required: true,
            index: true,
        },
        quantity: {
            type: Number,
            required: true,
        },
        balance_after: {
            type: Number,
            required: true,
        },
        unit_cost: {
            type: Number,
            default: 0,
        },
        reference_type: {
            type: String,
            trim: true,
        },
        reference_id: {
            type: String,
            trim: true,
        },
        remarks: {
            type: String,
            trim: true,
        },
        created_by_user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
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

stockLogSchema.virtual('medicine', {
    ref: 'Medicine',
    localField: 'medicine_id',
    foreignField: '_id',
    justOne: true,
});

stockLogSchema.virtual('batch', {
    ref: 'MedicineBatch',
    localField: 'batch_id',
    foreignField: '_id',
    justOne: true,
});

stockLogSchema.virtual('created_by', {
    ref: 'PharmacyStaff',
    localField: 'created_by_user_id',
    foreignField: '_id',
    justOne: true,
});


const StockLog = mongoose.model('StockLog', stockLogSchema);

module.exports = StockLog;
