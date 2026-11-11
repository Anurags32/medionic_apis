const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
    PARTNER_TYPES,
    PARTNER_VERIFICATION_STATUS,
    PARTNER_ACCOUNT_STATUS,
    VEHICLE_TYPES,
} = require('../../config/deliveryConstants');

const kycDocSchema = new mongoose.Schema(
    {
        doc_type: {
            type: String,
            required: true,
            enum: ['AADHAAR', 'PAN', 'DRIVING_LICENSE', 'VEHICLE_RC', 'OTHER'],
        },
        doc_number: {
            type: String,
            trim: true,
        },
        doc_url: {
            type: String,
            required: true,
        },
        verified: {
            type: Boolean,
            default: false,
        },
        verified_at: Date,
    },
    { _id: true }
);

const deliveryPartnerSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        partner_code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
            index: true,
        },
        partner_type: {
            type: String,
            required: true,
            enum: Object.values(PARTNER_TYPES),
            default: PARTNER_TYPES.PLATFORM_PARTNER,
            index: true,
        },
        full_name: {
            type: String,
            required: [true, 'Full name is required'],
            trim: true,
        },
        mobile: {
            type: String,
            required: [true, 'Mobile number is required'],
            unique: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            index: true,
        },
        password_hash: {
            type: String,
            required: [true, 'Password is required'],
        },
        profile_image: {
            type: String,
            default: null,
        },
        pharmacy_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            default: null,
            index: true,
            validate: {
                validator: function (val) {
                    if (this.partner_type === PARTNER_TYPES.PHARMACY_STAFF) {
                        return !!val;
                    }
                    return true;
                },
                message: 'pharmacy_id is required for PHARMACY_STAFF',
            },
        },
        employee_id: {
            type: String,
            trim: true,
            default: null,
        },
        vehicle_type: {
            type: String,
            enum: Object.values(VEHICLE_TYPES),
            default: VEHICLE_TYPES.MOTORCYCLE,
        },
        vehicle_number: {
            type: String,
            trim: true,
            uppercase: true,
            default: null,
        },
        license_document: {
            license_number: { type: String, trim: true, default: null },
            doc_url: { type: String, default: null },
            expiry_date: { type: Date, default: null },
        },
        kyc_documents: [kycDocSchema],
        verification_status: {
            type: String,
            enum: Object.values(PARTNER_VERIFICATION_STATUS),
            default: PARTNER_VERIFICATION_STATUS.PENDING,
            index: true,
        },
        verification_remarks: {
            type: String,
            trim: true,
            default: null,
        },
        account_status: {
            type: String,
            enum: Object.values(PARTNER_ACCOUNT_STATUS),
            default: PARTNER_ACCOUNT_STATUS.ACTIVE,
            index: true,
        },
        is_online: {
            type: Boolean,
            default: false,
            index: true,
        },
        is_available: {
            type: Boolean,
            default: true,
            index: true,
        },
        current_location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0],
            },
        },
        last_location_updated_at: {
            type: Date,
            default: null,
        },
        working_hours: {
            start: { type: String, default: '08:00' },
            end: { type: String, default: '22:00' },
            days: { type: [String], default: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] },
        },
        rating: {
            average: { type: Number, default: 5.0, min: 1, max: 5 },
            count: { type: Number, default: 0 },
        },
        total_deliveries: {
            type: Number,
            default: 0,
        },
        fcm_token: {
            type: String,
            trim: true,
            default: null,
        },
        fcm_platform: {
            type: String,
            enum: ['android', 'ios', 'web', null],
            default: null,
        },
        token_version: {
            type: Number,
            default: 1,
        },
        otp: {
            code_hash: String,
            expires_at: Date,
            purpose: String,
        },
        reset_password_token: String,
        reset_password_expires: Date,
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
                delete ret.otp;
                delete ret.reset_password_token;
                delete ret.reset_password_expires;
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
                delete ret.otp;
                return ret;
            },
        },
    }
);

// Indexes
deliveryPartnerSchema.index({ current_location: '2dsphere' });
deliveryPartnerSchema.index({ partner_type: 1, is_online: 1, is_available: 1, account_status: 1 });
deliveryPartnerSchema.index({ pharmacy_id: 1, partner_type: 1, account_status: 1 });

// Password comparison
deliveryPartnerSchema.methods.comparePassword = async function (enteredPassword) {
    if (!this.password_hash) return false;
    return bcrypt.compare(enteredPassword, this.password_hash);
};

// Static helper to generate partner code
deliveryPartnerSchema.statics.generatePartnerCode = async function (type) {
    const prefix = type === PARTNER_TYPES.PHARMACY_STAFF ? 'DPS' : 'DPP';
    const random = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${random}`;
};

const DeliveryPartner = mongoose.models.DeliveryPartner || mongoose.model('DeliveryPartner', deliveryPartnerSchema);

module.exports = DeliveryPartner;

