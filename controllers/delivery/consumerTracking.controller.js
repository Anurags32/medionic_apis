const { Delivery, DeliveryLocationHistory } = require('../../models/delivery');
const Order = require('../../models/pharmacy/order.model');
const PharmacyOrder = require('../../models/PharmacyOrder');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { DELIVERY_STATUS } = require('../../config/deliveryConstants');

/**
 * Helper to fetch delivery for order and verify ownership
 */
async function resolveConsumerDelivery(orderId, userId) {
    // Check both unified Order and legacy PharmacyOrder
    let delivery = await Delivery.findOne({ order_id: orderId })
        .populate('delivery_partner_id', 'full_name mobile vehicle_type vehicle_number rating current_location')
        .populate('pharmacy_id', 'name address contact_number location');

    if (!delivery) {
        // Check if order exists
        const order = (await Order.findById(orderId)) || (await PharmacyOrder.findById(orderId));
        if (!order) {
            throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
        }
        return { order, delivery: null };
    }

    return { order: null, delivery };
}

// GET /api/consumer/orders/:orderId/delivery
const getOrderDelivery = asyncHandler(async (req, res) => {
    const { order, delivery } = await resolveConsumerDelivery(req.params.orderId, req.user?._id);

    if (!delivery) {
        return res.status(200).json({
            success: true,
            data: {
                orderId: req.params.orderId,
                deliveryStatus: 'PENDING',
                message: 'Delivery has not been assigned yet.',
            },
        });
    }

    res.status(200).json({
        success: true,
        data: delivery,
    });
});

// GET /api/consumer/orders/:orderId/tracking
const getOrderTracking = asyncHandler(async (req, res) => {
    const { order, delivery } = await resolveConsumerDelivery(req.params.orderId, req.user?._id);

    if (!delivery) {
        return res.status(200).json({
            success: true,
            data: {
                orderId: req.params.orderId,
                status: 'PENDING',
                trackingAvailable: false,
                message: 'Live tracking will be available once a partner starts delivery.',
            },
        });
    }

    // Only expose live GPS if delivery is active/in-transit
    const isLive = [
        DELIVERY_STATUS.PICKED_UP,
        DELIVERY_STATUS.OUT_FOR_DELIVERY,
        DELIVERY_STATUS.REACHED_CUSTOMER,
    ].includes(delivery.delivery_status);

    const partner = delivery.delivery_partner_id;

    res.status(200).json({
        success: true,
        data: {
            deliveryId: delivery._id,
            orderId: delivery.order_id,
            deliveryStatus: delivery.delivery_status,
            trackingAvailable: isLive,
            currentLocation: isLive ? delivery.current_location : null,
            dropLocation: delivery.drop_location,
            pickupLocation: delivery.pickup_location,
            partner: partner
                ? {
                      name: partner.full_name,
                      phone: partner.mobile,
                      vehicleType: partner.vehicle_type,
                      vehicleNumber: partner.vehicle_number,
                      rating: partner.rating?.average || 5.0,
                  }
                : null,
            deliveredAt: delivery.delivered_at,
        },
    });
});

// GET /api/consumer/orders/:orderId/delivery-status
const getOrderDeliveryStatus = asyncHandler(async (req, res) => {
    const { order, delivery } = await resolveConsumerDelivery(req.params.orderId, req.user?._id);

    res.status(200).json({
        success: true,
        data: {
            orderId: req.params.orderId,
            deliveryStatus: delivery ? delivery.delivery_status : 'PENDING',
            deliveredAt: delivery?.delivered_at || null,
            failureReason: delivery?.failure_reason || null,
        },
    });
});

// GET /api/consumer/orders/:orderId/delivery-partner
const getOrderDeliveryPartner = asyncHandler(async (req, res) => {
    const { order, delivery } = await resolveConsumerDelivery(req.params.orderId, req.user?._id);

    if (!delivery || !delivery.delivery_partner_id) {
        return res.status(200).json({
            success: true,
            data: null,
            message: 'No delivery partner assigned yet',
        });
    }

    const partner = delivery.delivery_partner_id;

    res.status(200).json({
        success: true,
        data: {
            name: partner.full_name,
            phone: partner.mobile,
            vehicleType: partner.vehicle_type,
            vehicleNumber: partner.vehicle_number,
            rating: partner.rating?.average || 5.0,
        },
    });
});

module.exports = {
    getOrderDelivery,
    getOrderTracking,
    getOrderDeliveryStatus,
    getOrderDeliveryPartner,
};
