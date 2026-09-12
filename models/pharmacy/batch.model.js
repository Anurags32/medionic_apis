const mongoose = require('mongoose');

const medicineBatchSchema = new mongoose.Schema(
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
        batch_number: {
            type: String,
            required: true,
            trim: true,
        },
        mfg_date: {
            type: Date,
        },
        expiry_date: {
            type: Date,
            required: true,
            index: true,
        },
        purchase_rate: {
            type: Number,
            required: true,
            default: 0,
        },
        mrp: {
            type: Number,
            required: true,
        },
        sale_price: {
            type: Number,
            required: true,
        },
        gst_rate: {
            type: Number,
            default: 0,
        },
        current_stock: {
            type: Number,
            default: 0,
            index: true,
        },
        rack_location: {
            type: String,
            trim: true,
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

medicineBatchSchema.virtual('medicine', {
    ref: 'Medicine',
    localField: 'medicine_id',
    foreignField: '_id',
    justOne: true,
});

const MedicineBatch = mongoose.model('MedicineBatch', medicineBatchSchema);

module.exports = MedicineBatch;
