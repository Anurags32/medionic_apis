const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        otp_code: {
            type: String,
            required: true,
            trim: true,
        },
        expires_at: {
            type: Date,
            required: true,
            index: true,
        },
        is_used: {
            type: Boolean,
            default: false,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        purpose: {
            type: String,
            default: 'LOGIN',
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

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
