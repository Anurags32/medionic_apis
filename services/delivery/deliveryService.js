const bcrypt = require('bcryptjs');
const {
    Delivery,
    DeliveryPartner,
    DeliveryEarning,
    PharmacyDeliverySettings,
} = require('../../models/delivery');
const Order = require('../../models/pharmacy/order.model');
const PharmacyOrder = require('../../models/PharmacyOrder');
const { DELIVERY_STATUS, RETURN_STATUS, SETTLEMENT_STATUS } = require('../../config/deliveryConstants');
const { emitDeliveryEvent } = require('../../socket/deliveryEvents');
const { sendDeliveryFCM } = require('./deliveryNotificationService');
const ApiError = require('../../utils/ApiError');

/**
 * Marks delivery partner as reached the pharmacy
 */
async function reachedPharmacy(deliveryId, partnerId) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found or unauthorized', 'DELIVERY_NOT_FOUND');
    }

    delivery.delivery_status = DELIVERY_STATUS.REACHED_PHARMACY;
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.order_id, {
        delivery_status: DELIVERY_STATUS.REACHED_PHARMACY,
    });

    emitDeliveryEvent(`pharmacy:${delivery.pharmacy_id}`, 'delivery_reached_pharmacy', {
        deliveryId: delivery._id.toString(),
        orderId: delivery.order_id.toString(),
        message: 'Delivery partner has reached the pharmacy for pickup.',
    });

    return delivery;
}

/**
 * Verifies pickup OTP provided by pharmacy to delivery partner
 */
async function verifyPickupOtp(deliveryId, partnerId, otpCode) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    if (!delivery.pickup_otp_hash) {
        throw new ApiError(400, 'No pickup OTP configured for this delivery', 'NO_OTP');
    }

    const isValid = await bcrypt.compare(String(otpCode).trim(), delivery.pickup_otp_hash);
    if (!isValid) {
        throw new ApiError(400, 'Invalid pickup OTP. Please verify with the pharmacy.', 'INVALID_OTP');
    }

    delivery.pickup_verified_at = new Date();
    await delivery.save();

    return { success: true, message: 'Pickup OTP verified successfully' };
}

/**
 * Confirms order pickup with optional photo or signature proof
 */
async function pickupConfirm(deliveryId, partnerId, proof = {}) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    if (!delivery.pickup_verified_at) {
        throw new ApiError(400, 'Pickup OTP must be verified before confirming pickup', 'OTP_NOT_VERIFIED');
    }

    delivery.delivery_status = DELIVERY_STATUS.PICKED_UP;
    if (proof) {
        delivery.pickup_proof = {
            image_url: proof.image_url || null,
            notes: proof.notes || null,
            signature_url: proof.signature_url || null,
        };
    }
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.order_id, {
        status: 'PICKED_UP',
        delivery_status: DELIVERY_STATUS.PICKED_UP,
    });

    const legacyOrder = await PharmacyOrder.findOne({ _id: delivery.order_id });
    if (legacyOrder) {
        legacyOrder.deliveryStatus = DELIVERY_STATUS.PICKED_UP;
        await legacyOrder.save();
    }

    emitDeliveryEvent(`pharmacy:${delivery.pharmacy_id}`, 'delivery_pickup_confirmed', {
        deliveryId: delivery._id.toString(),
        orderId: delivery.order_id.toString(),
        message: 'Order has been picked up by the delivery partner.',
    });

    return delivery;
}

/**
 * Starts the delivery transit journey
 */
async function startDelivery(deliveryId, partnerId) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    delivery.delivery_status = DELIVERY_STATUS.OUT_FOR_DELIVERY;
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.order_id, {
        status: 'OUT_FOR_DELIVERY',
        delivery_status: DELIVERY_STATUS.OUT_FOR_DELIVERY,
    });

    const legacyOrder = await PharmacyOrder.findOne({ _id: delivery.order_id });
    if (legacyOrder) {
        legacyOrder.status = 'shipped';
        legacyOrder.deliveryStatus = DELIVERY_STATUS.OUT_FOR_DELIVERY;
        await legacyOrder.save();
    }

    const payload = {
        deliveryId: delivery._id.toString(),
        orderId: delivery.order_id.toString(),
        message: 'Your medicine order is now out for delivery.',
    };

    emitDeliveryEvent(`delivery:${delivery._id}`, 'delivery_started', payload);
    emitDeliveryEvent(`pharmacy:${delivery.pharmacy_id}`, 'delivery_started', payload);
    if (delivery.consumer_id) {
        emitDeliveryEvent(`consumer:${delivery.consumer_id}`, 'delivery_started', payload);
    }

    return delivery;
}

/**
 * Marks partner as reached customer location
 */
async function reachedCustomer(deliveryId, partnerId) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    delivery.delivery_status = DELIVERY_STATUS.REACHED_CUSTOMER;
    await delivery.save();

    const payload = {
        deliveryId: delivery._id.toString(),
        orderId: delivery.order_id.toString(),
        message: 'Delivery partner has reached your address.',
    };

    if (delivery.consumer_id) {
        emitDeliveryEvent(`consumer:${delivery.consumer_id}`, 'delivery_reached_customer', payload);
    }

    return delivery;
}

/**
 * Verifies delivery OTP provided by customer
 */
async function verifyDeliveryOtp(deliveryId, partnerId, otpCode) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    if (!delivery.delivery_otp_hash) {
        throw new ApiError(400, 'No delivery OTP configured for this delivery', 'NO_OTP');
    }

    const isValid = await bcrypt.compare(String(otpCode).trim(), delivery.delivery_otp_hash);
    if (!isValid) {
        throw new ApiError(400, 'Invalid delivery OTP. Please verify with the customer.', 'INVALID_OTP');
    }

    return { success: true, message: 'Delivery OTP verified successfully' };
}

/**
 * Completes delivery and calculates earnings
 */
async function completeDelivery(deliveryId, partnerId, proof = {}) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    const now = new Date();
    delivery.delivery_status = DELIVERY_STATUS.DELIVERED;
    delivery.delivered_at = now;
    if (proof) {
        delivery.delivery_proof = {
            image_url: proof.image_url || null,
            notes: proof.notes || null,
            signature_url: proof.signature_url || null,
        };
    }
    await delivery.save();

    // Update order status
    await Order.findByIdAndUpdate(delivery.order_id, {
        status: 'DELIVERED',
        delivery_status: DELIVERY_STATUS.DELIVERED,
        delivered_at: now,
    });

    const legacyOrder = await PharmacyOrder.findOne({ _id: delivery.order_id });
    if (legacyOrder) {
        legacyOrder.status = 'delivered';
        legacyOrder.actualDelivery = now;
        legacyOrder.deliveryStatus = DELIVERY_STATUS.DELIVERED;
        await legacyOrder.save();
    }

    // Increment partner delivery count
    await DeliveryPartner.findByIdAndUpdate(partnerId, {
        $inc: { total_deliveries: 1 },
    });

    // Calculate Partner Earnings
    const settings = await PharmacyDeliverySettings.findOne({ pharmacy_id: delivery.pharmacy_id });
    const basePayout = settings?.delivery_charges_configuration?.base_charge || 40;
    const grossAmount = basePayout;
    const commission = Math.round(grossAmount * 0.1 * 100) / 100; // 10% platform fee
    const netAmount = grossAmount - commission;

    const earning = await DeliveryEarning.create({
        partner_id: partnerId,
        order_id: delivery.order_id,
        pharmacy_id: delivery.pharmacy_id,
        gross_amount: grossAmount,
        commission,
        incentive: 0,
        adjustment: 0,
        net_amount: netAmount,
        settlement_status: SETTLEMENT_STATUS.PENDING,
    });

    const payload = {
        deliveryId: delivery._id.toString(),
        orderId: delivery.order_id.toString(),
        deliveredAt: now,
        netAmount,
        message: 'Order successfully delivered.',
    };

    emitDeliveryEvent(`delivery:${delivery._id}`, 'delivery_completed', payload);
    emitDeliveryEvent(`pharmacy:${delivery.pharmacy_id}`, 'delivery_completed', payload);
    if (delivery.consumer_id) {
        emitDeliveryEvent(`consumer:${delivery.consumer_id}`, 'delivery_completed', payload);
    }

    return { delivery, earning };
}

/**
 * Fails a delivery attempt with reason
 */
async function failDelivery(deliveryId, partnerId, reason) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    delivery.delivery_status = DELIVERY_STATUS.FAILED;
    delivery.failure_reason = reason || 'Customer unavailable or unreachable';
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.order_id, {
        delivery_status: DELIVERY_STATUS.FAILED,
    });

    const payload = {
        deliveryId: delivery._id.toString(),
        orderId: delivery.order_id.toString(),
        reason: delivery.failure_reason,
        message: `Delivery attempt failed: ${delivery.failure_reason}`,
    };

    emitDeliveryEvent(`pharmacy:${delivery.pharmacy_id}`, 'delivery_failed', payload);

    return delivery;
}

/**
 * Returns order items back to pharmacy
 */
async function returnDelivery(deliveryId, partnerId, reason) {
    const delivery = await Delivery.findOne({ _id: deliveryId, delivery_partner_id: partnerId });
    if (!delivery) {
        throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
    }

    delivery.delivery_status = DELIVERY_STATUS.RETURNED;
    delivery.return_status = RETURN_STATUS.RETURNED_TO_PHARMACY;
    delivery.failure_reason = reason || delivery.failure_reason || 'Return initiated';
    await delivery.save();

    await Order.findByIdAndUpdate(delivery.order_id, {
        delivery_status: DELIVERY_STATUS.RETURNED,
    });

    emitDeliveryEvent(`pharmacy:${delivery.pharmacy_id}`, 'delivery_returned', {
        deliveryId: delivery._id.toString(),
        orderId: delivery.order_id.toString(),
        message: 'Order returned to pharmacy.',
    });

    return delivery;
}

/**
 * Retrieves delivery live tracking details
 */
async function getDeliveryTracking(deliveryId, requestingUser) {
    const delivery = await Delivery.findById(deliveryId)
        .populate('delivery_partner_id', 'full_name mobile vehicle_type vehicle_number rating current_location')
        .populate('pharmacy_id', 'name address contact_number location');

    if (!delivery) {
        throw new ApiError(404, 'Delivery tracking not found', 'DELIVERY_NOT_FOUND');
    }

    return delivery;
}

module.exports = {
    reachedPharmacy,
    verifyPickupOtp,
    pickupConfirm,
    startDelivery,
    reachedCustomer,
    verifyDeliveryOtp,
    completeDelivery,
    failDelivery,
    returnDelivery,
    getDeliveryTracking,
};

