const mongoose = require('mongoose');

const deliveryLocationHistorySchema = new mongoose.Schema(
    {
        delivery_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Delivery',
            required: true,
            index: true,
        },
        partner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryPartner',
            required: true,
            index: true,
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
                required: true,
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true,
            },
        },
        heading: {
            type: Number,
            default: 0,
        },
        speed: {
            type: Number,
            default: 0,
        },
        accuracy: {
            type: Number,
            default: 0,
        },
        recorded_at: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: false,
    }
);

deliveryLocationHistorySchema.index({ location: '2dsphere' });
deliveryLocationHistorySchema.index({ delivery_id: 1, recorded_at: -1 });

const DeliveryLocationHistory =
    mongoose.models.DeliveryLocationHistory ||
    mongoose.model('DeliveryLocationHistory', deliveryLocationHistorySchema);

module.exports = DeliveryLocationHistory;

