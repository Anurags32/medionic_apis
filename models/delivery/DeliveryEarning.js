const mongoose = require('mongoose');
const { SETTLEMENT_STATUS } = require('../../config/deliveryConstants');

const deliveryEarningSchema = new mongoose.Schema(
    {
        partner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryPartner',
            required: true,
            index: true,
        },
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        pharmacy_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            default: null,
            index: true,
        },
        gross_amount: {
            type: Number,
            required: true,
            default: 0,
        },
        commission: {
            type: Number,
            default: 0,
        },
        incentive: {
            type: Number,
            default: 0,
        },
        adjustment: {
            type: Number,
            default: 0,
        },
        net_amount: {
            type: Number,
            required: true,
            default: 0,
        },
        settlement_status: {
            type: String,
            enum: Object.values(SETTLEMENT_STATUS),
            default: SETTLEMENT_STATUS.PENDING,
            index: true,
        },
        settlement_reference: {
            type: String,
            trim: true,
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

deliveryEarningSchema.index({ partner_id: 1, created_at: -1 });

const DeliveryEarning =
    mongoose.models.DeliveryEarning ||
    mongoose.model('DeliveryEarning', deliveryEarningSchema);

module.exports = DeliveryEarning;

