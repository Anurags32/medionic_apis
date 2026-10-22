const mongoose = require('mongoose');

/** Distributor / wholesaler a branch buys stock from. */
const supplierSchema = new mongoose.Schema(
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
        contact_person: {
            type: String,
            trim: true,
            default: '',
        },
        phone: {
            type: String,
            trim: true,
            default: '',
            index: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
        },
        gstin: {
            type: String,
            trim: true,
            uppercase: true,
            default: '',
        },
        dl_number: {
            type: String,
            trim: true,
            default: '',
        },
        address: {
            type: String,
            trim: true,
            default: '',
        },
        notes: {
            type: String,
            trim: true,
            default: '',
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
    }
);

supplierSchema.index({ branch_id: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
