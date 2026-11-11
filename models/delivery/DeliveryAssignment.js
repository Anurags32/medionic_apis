const mongoose = require('mongoose');
const {
    PARTNER_TYPES,
    ASSIGNMENT_STATUS,
    ASSIGNMENT_METHODS,
} = require('../../config/deliveryConstants');

const deliveryAssignmentSchema = new mongoose.Schema(
    {
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        pharmacy_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        delivery_partner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryPartner',
            required: true,
            index: true,
        },
        partner_type: {
            type: String,
            enum: Object.values(PARTNER_TYPES),
            required: true,
        },
        assignment_status: {
            type: String,
            enum: Object.values(ASSIGNMENT_STATUS),
            default: ASSIGNMENT_STATUS.OFFERED,
            index: true,
        },
        assignment_method: {
            type: String,
            enum: Object.values(ASSIGNMENT_METHODS),
            default: ASSIGNMENT_METHODS.AUTO,
        },
        offered_at: {
            type: Date,
            default: Date.now,
        },
        expires_at: {
            type: Date,
            required: true,
            index: true,
        },
        accepted_at: {
            type: Date,
            default: null,
        },
        rejected_at: {
            type: Date,
            default: null,
        },
        rejection_reason: {
            type: String,
            trim: true,
            default: null,
        },
        assigned_by: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        assignment_attempt: {
            type: Number,
            default: 1,
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

deliveryAssignmentSchema.index({ delivery_partner_id: 1, assignment_status: 1 });
deliveryAssignmentSchema.index({ order_id: 1, assignment_attempt: -1 });

deliveryAssignmentSchema.virtual('delivery_partner', {
    ref: 'DeliveryPartner',
    localField: 'delivery_partner_id',
    foreignField: '_id',
    justOne: true,
});

deliveryAssignmentSchema.virtual('pharmacy', {
    ref: 'Branch',
    localField: 'pharmacy_id',
    foreignField: '_id',
    justOne: true,
});

const DeliveryAssignment =
    mongoose.models.DeliveryAssignment ||
    mongoose.model('DeliveryAssignment', deliveryAssignmentSchema);

module.exports = DeliveryAssignment;

