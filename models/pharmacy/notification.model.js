const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PharmacyStaff',
            default: null,
            index: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ['ORDER', 'INVENTORY', 'PRESCRIPTION', 'SYSTEM'],
            default: 'SYSTEM',
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        is_read: {
            type: Boolean,
            default: false,
            index: true,
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

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
