const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        category_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        generic_name: {
            type: String,
            trim: true,
        },
        sku_barcode: {
            type: String,
            trim: true,
            index: true,
        },
        manufacturer: {
            type: String,
            trim: true,
        },
        hsn_code: {
            type: String,
            trim: true,
        },
        form: {
            type: String,
            trim: true,
        },
        unit: {
            type: String,
            trim: true,
        },
        unit_quantity: {
            type: Number,
            default: 1,
        },
        is_prescription_required: {
            type: Boolean,
            default: false,
        },
        low_stock_threshold: {
            type: Number,
            default: 10,
        },
        side_effects: {
            type: String,
            trim: true,
        },
        storage_instructions: {
            type: String,
            trim: true,
        },
        image_url: {
            type: String,
            trim: true,
        },
        mrp: {
            type: Number,
            default: 0,
        },
        sale_price: {
            type: Number,
            default: 0,
        },
        purchase_rate: {
            type: Number,
            default: 0,
        },
        gst_rate: {
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

medicineSchema.virtual('category', {
    ref: 'Category',
    localField: 'category_id',
    foreignField: '_id',
    justOne: true,
});

medicineSchema.virtual('batches', {
    ref: 'MedicineBatch',
    localField: '_id',
    foreignField: 'medicine_id',
});

medicineSchema.index({ branch_id: 1, is_active: 1, name: 1 });
medicineSchema.index({ branch_id: 1, category_id: 1 });
medicineSchema.index({ branch_id: 1, sku_barcode: 1 });

const Medicine = mongoose.model('Medicine', medicineSchema);

module.exports = Medicine;
