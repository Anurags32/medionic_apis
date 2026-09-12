const mongoose = require('mongoose');
const { ROLES } = require('../../config/pharmacyConstants');


const userSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        full_name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        password_hash: {
            type: String,
            required: true,
        },
        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.STAFF,
        },
        pharmacist_reg_no: {
            type: String,
            trim: true,
        },
        features_granted: {
            type: [String],
            default: [],
        },
        is_active: {
            type: Boolean,
            default: true,
        },
        is_blocked: {
            type: Boolean,
            default: false,
        },
        block_reason: {
            type: String,
            default: null,
        },
        // Admin approval status — only for PHARMACY_OWNER role
        approval_status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
        approval_remarks: {
            type: String,
            default: null,
        },
        fcm_token: {
            type: String,
            default: null,
        },
        token_version: {
            type: Number,
            default: 1,
        },
        is_online: {
            type: Boolean,
            default: false,
        },
        last_seen_at: {
            type: Date,
            default: null,
        },
        last_login_at: {
            type: Date,
            default: null,
        },
        duty_status: {
            type: String,
            enum: ['ON_DUTY', 'OFF_DUTY'],
            default: 'OFF_DUTY',
            index: true,
        },
        current_location: {
            latitude: {
                type: Number,
                default: null,
            },
            longitude: {
                type: Number,
                default: null,
            },
            address: {
                type: String,
                trim: true,
                default: null,
            },
            updated_at: {
                type: Date,
                default: null,
            },
        },
        last_duty_toggle_at: {
            type: Date,
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
                delete ret.password_hash;
                return ret;
            },
        },
        toObject: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                delete ret.password_hash;
                return ret;
            },
        },
    }
);

userSchema.virtual('branch', {
    ref: 'Branch',
    localField: 'branch_id',
    foreignField: '_id',
    justOne: true,
});

const User = mongoose.models.PharmacyStaff || mongoose.model('PharmacyStaff', userSchema, 'pharmacy_users');

module.exports = User;