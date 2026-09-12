const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        drug_license_no: {
            type: String,
            required: true,
            trim: true,
        },
        gstin: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        contact_number: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        owner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        is_available: {
            type: Boolean,
            default: true,
        },
        latitude: {
            type: Number,
            default: null,
        },
        longitude: {
            type: Number,
            default: null,
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

branchSchema.virtual('staff', {
    ref: 'PharmacyStaff',
    localField: '_id',
    foreignField: 'branch_id',
});


const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch;