const mongoose = require('mongoose');
const {
    DELIVERY_MODES,
    DEFAULT_ASSIGNMENT_TIMEOUT_SECONDS,
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_MAX_ACTIVE_DELIVERIES,
} = require('../../config/deliveryConstants');

const pharmacyDeliverySettingsSchema = new mongoose.Schema(
    {
        pharmacy_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            unique: true,
            index: true,
        },
        delivery_mode: {
            type: String,
            enum: Object.values(DELIVERY_MODES),
            default: DELIVERY_MODES.BOTH,
        },
        enable_platform_delivery: {
            type: Boolean,
            default: true,
        },
        enable_own_staff_delivery: {
            type: Boolean,
            default: true,
        },
        auto_assignment_enabled: {
            type: Boolean,
            default: true,
        },
        manual_assignment_enabled: {
            type: Boolean,
            default: true,
        },
        max_assignment_radius_km: {
            type: Number,
            default: DEFAULT_MAX_RADIUS_KM,
            min: 1,
            max: 50,
        },
        assignment_timeout_seconds: {
            type: Number,
            default: DEFAULT_ASSIGNMENT_TIMEOUT_SECONDS,
            min: 15,
            max: 300,
        },
        max_active_deliveries_per_partner: {
            type: Number,
            default: DEFAULT_MAX_ACTIVE_DELIVERIES,
            min: 1,
            max: 10,
        },
        delivery_charges_configuration: {
            base_charge: { type: Number, default: 30 },
            base_distance_km: { type: Number, default: 3 },
            per_km_charge: { type: Number, default: 10 },
            free_delivery_above: { type: Number, default: 500 },
        },
        working_hours: {
            start: { type: String, default: '08:00' },
            end: { type: String, default: '22:00' },
            auto_offline_after_hours: { type: Boolean, default: true },
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

pharmacyDeliverySettingsSchema.virtual('pharmacy', {
    ref: 'Branch',
    localField: 'pharmacy_id',
    foreignField: '_id',
    justOne: true,
});

const PharmacyDeliverySettings =
    mongoose.models.PharmacyDeliverySettings ||
    mongoose.model('PharmacyDeliverySettings', pharmacyDeliverySettingsSchema);

module.exports = PharmacyDeliverySettings;

