const mongoose = require('mongoose');
const {
    DELIVERY_STATUS,
    RETURN_STATUS,
} = require('../../config/deliveryConstants');

const deliverySchema = new mongoose.Schema(
    {
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            unique: true,
            index: true,
        },
        pharmacy_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        consumer_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        delivery_partner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryPartner',
            required: true,
            index: true,
        },
        pickup_location: {
            pharmacy_name: { type: String, trim: true },
            contact_phone: { type: String, trim: true },
            address: { type: String, required: true },
            location: {
                type: { type: String, enum: ['Point'], default: 'Point' },
                coordinates: { type: [Number], default: [0, 0] },
            },
        },
        drop_location: {
            customer_name: { type: String, trim: true },
            contact_phone: { type: String, trim: true },
            address: { type: String, required: true },
            city: { type: String, trim: true },
            pincode: { type: String, trim: true },
            location: {
                type: { type: String, enum: ['Point'], default: 'Point' },
                coordinates: { type: [Number], default: [0, 0] },
            },
        },
        current_location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: [0, 0] },
        },
        delivery_status: {
            type: String,
            enum: Object.values(DELIVERY_STATUS),
            default: DELIVERY_STATUS.ASSIGNED,
            index: true,
        },
        pickup_otp_hash: {
            type: String,
            default: null,
        },
        delivery_otp_hash: {
            type: String,
            default: null,
        },
        pickup_verified_at: {
            type: Date,
            default: null,
        },
        delivered_at: {
            type: Date,
            default: null,
        },
        pickup_proof: {
            image_url: { type: String, default: null },
            notes: { type: String, default: null },
            signature_url: { type: String, default: null },
        },
        delivery_proof: {
            image_url: { type: String, default: null },
            notes: { type: String, default: null },
            signature_url: { type: String, default: null },
        },
        delivery_distance_km: {
            type: Number,
            default: 0,
        },
        delivery_duration_minutes: {
            type: Number,
            default: 0,
        },
        failure_reason: {
            type: String,
            default: null,
        },
        return_status: {
            type: String,
            enum: Object.values(RETURN_STATUS),
            default: RETURN_STATUS.NOT_APPLICABLE,
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
                delete ret.pickup_otp_hash;
                delete ret.delivery_otp_hash;
                return ret;
            },
        },
        toObject: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                delete ret.pickup_otp_hash;
                delete ret.delivery_otp_hash;
                return ret;
            },
        },
    }
);

deliverySchema.index({ current_location: '2dsphere' });
deliverySchema.index({ delivery_partner_id: 1, delivery_status: 1 });
deliverySchema.index({ pharmacy_id: 1, delivery_status: 1 });

deliverySchema.virtual('delivery_partner', {
    ref: 'DeliveryPartner',
    localField: 'delivery_partner_id',
    foreignField: '_id',
    justOne: true,
});

deliverySchema.virtual('pharmacy', {
    ref: 'Branch',
    localField: 'pharmacy_id',
    foreignField: '_id',
    justOne: true,
});

const Delivery = mongoose.models.Delivery || mongoose.model('Delivery', deliverySchema);

module.exports = Delivery;

