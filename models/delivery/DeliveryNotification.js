const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../../config/deliveryConstants');

const deliveryNotificationSchema = new mongoose.Schema(
    {
        partner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryPartner',
            required: true,
            index: true,
        },
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        notification_type: {
            type: String,
            enum: Object.values(NOTIFICATION_TYPES),
            required: true,
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
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        read_at: {
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

deliveryNotificationSchema.index({ partner_id: 1, read_at: 1, created_at: -1 });

const DeliveryNotification =
    mongoose.models.DeliveryNotification ||
    mongoose.model('DeliveryNotification', deliveryNotificationSchema);

module.exports = DeliveryNotification;

