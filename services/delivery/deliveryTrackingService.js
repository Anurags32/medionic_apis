const {
    DeliveryPartner,
    Delivery,
    DeliveryLocationHistory,
} = require('../../models/delivery');
const { DELIVERY_STATUS, NOTIFICATION_TYPES } = require('../../config/deliveryConstants');
const { calculateDistanceKm } = require('./deliveryAssignmentService');
const { emitDeliveryEvent } = require('../../socket/deliveryEvents');
const { notifyPartner } = require('./deliveryNotificationService');
const ApiError = require('../../utils/ApiError');

/**
 * Ingests a real-time GPS coordinate from a delivery partner
 */
async function updatePartnerLocation(partnerId, { latitude, longitude, heading = 0, speed = 0, accuracy = 0 }) {
    if (latitude === undefined || longitude === undefined) {
        throw new ApiError(400, 'latitude and longitude are required', 'COORDINATES_REQUIRED');
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new ApiError(400, 'Invalid latitude or longitude values', 'INVALID_COORDINATES');
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
        partnerId,
        {
            $set: {
                current_location: {
                    type: 'Point',
                    coordinates: [lon, lat],
                },
                last_location_updated_at: new Date(),
            },
        },
        { new: true }
    );

    if (!partner) {
        throw new ApiError(404, 'Delivery partner not found', 'PARTNER_NOT_FOUND');
    }

    // Check for an active delivery currently in progress
    const activeDelivery = await Delivery.findOne({
        delivery_partner_id: partnerId,
        delivery_status: {
            $in: [
                DELIVERY_STATUS.ASSIGNED,
                DELIVERY_STATUS.REACHED_PHARMACY,
                DELIVERY_STATUS.PICKED_UP,
                DELIVERY_STATUS.OUT_FOR_DELIVERY,
                DELIVERY_STATUS.REACHED_CUSTOMER,
            ],
        },
    });

    const locationPayload = {
        partnerId: partner._id.toString(),
        latitude: lat,
        longitude: lon,
        heading,
        speed,
        accuracy,
        updatedAt: partner.last_location_updated_at,
    };

    if (activeDelivery) {
        // Record breadcrumb in history
        await DeliveryLocationHistory.create({
            delivery_id: activeDelivery._id,
            partner_id: partner._id,
            location: {
                type: 'Point',
                coordinates: [lon, lat],
            },
            heading,
            speed,
            accuracy,
            recorded_at: new Date(),
        });

        // Update delivery current location
        activeDelivery.current_location = {
            type: 'Point',
            coordinates: [lon, lat],
        };
        await activeDelivery.save();

        const trackingPayload = {
            ...locationPayload,
            deliveryId: activeDelivery._id.toString(),
            orderId: activeDelivery.order_id.toString(),
            deliveryStatus: activeDelivery.delivery_status,
        };

        // Broadcast to relevant rooms
        emitDeliveryEvent(`delivery:${activeDelivery._id}`, 'delivery_tracking_update', trackingPayload);
        emitDeliveryEvent(`pharmacy:${activeDelivery.pharmacy_id}`, 'delivery_partner_location', trackingPayload);
        if (activeDelivery.consumer_id) {
            emitDeliveryEvent(`consumer:${activeDelivery.consumer_id}`, 'delivery_tracking_update', trackingPayload);
        }

        // Proximity check: Near customer if out for delivery and within 500m
        if (
            activeDelivery.delivery_status === DELIVERY_STATUS.OUT_FOR_DELIVERY &&
            activeDelivery.drop_location?.location?.coordinates &&
            activeDelivery.drop_location.location.coordinates[0] !== 0
        ) {
            const distKm = calculateDistanceKm(
                [lon, lat],
                activeDelivery.drop_location.location.coordinates
            );

            if (distKm <= 0.5) {
                activeDelivery.delivery_status = DELIVERY_STATUS.REACHED_CUSTOMER;
                await activeDelivery.save();

                emitDeliveryEvent(`consumer:${activeDelivery.consumer_id}`, 'delivery_reached_customer', {
                    deliveryId: activeDelivery._id.toString(),
                    orderId: activeDelivery.order_id.toString(),
                    message: 'Your delivery partner has arrived at your location.',
                });
            }
        }
    }

    return {
        latitude: lat,
        longitude: lon,
        lastLocationUpdatedAt: partner.last_location_updated_at,
    };
}

/**
 * Gets location history breadcrumbs for a delivery
 */
async function getDeliveryLocationHistory(deliveryId) {
    return DeliveryLocationHistory.find({ delivery_id: deliveryId })
        .sort({ recorded_at: 1 })
        .limit(500);
}

module.exports = {
    updatePartnerLocation,
    getDeliveryLocationHistory,
};

