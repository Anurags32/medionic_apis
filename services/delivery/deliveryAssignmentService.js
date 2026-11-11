const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
    DeliveryPartner,
    PharmacyDeliverySettings,
    DeliveryAssignment,
    Delivery,
} = require('../../models/delivery');
const Order = require('../../models/pharmacy/order.model');
const Branch = require('../../models/pharmacy/branch.model');
const PharmacyOrder = require('../../models/PharmacyOrder');
const ApiError = require('../../utils/ApiError');
const {
    PARTNER_TYPES,
    PARTNER_ACCOUNT_STATUS,
    PARTNER_VERIFICATION_STATUS,
    DELIVERY_MODES,
    ASSIGNMENT_STATUS,
    ASSIGNMENT_METHODS,
    DELIVERY_STATUS,
    DEFAULT_ASSIGNMENT_TIMEOUT_SECONDS,
    DEFAULT_MAX_RADIUS_KM,
    DEFAULT_MAX_ACTIVE_DELIVERIES,
} = require('../../config/deliveryConstants');
const { emitDeliveryEvent } = require('../../socket/deliveryEvents');
const { sendDeliveryFCM } = require('./deliveryNotificationService');

/**
 * Calculates Haversine distance in kilometers between two [lon, lat] coordinates
 */
function calculateDistanceKm(coord1, coord2) {
    if (!coord1 || !coord2 || coord1.length < 2 || coord2.length < 2) return 0;
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
}

/**
 * Generates a random 6-digit OTP code and returns its plain text and bcrypt hash
 */
async function generateOtp() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(code, salt);
    return { code, hash };
}

/**
 * Gets or creates default delivery settings for a pharmacy
 */
async function getPharmacySettings(pharmacyId) {
    let settings = await PharmacyDeliverySettings.findOne({ pharmacy_id: pharmacyId });
    if (!settings) {
        settings = await PharmacyDeliverySettings.create({
            pharmacy_id: pharmacyId,
            delivery_mode: DELIVERY_MODES.BOTH,
            enable_platform_delivery: true,
            enable_own_staff_delivery: true,
            auto_assignment_enabled: true,
            manual_assignment_enabled: true,
            max_assignment_radius_km: DEFAULT_MAX_RADIUS_KM,
            assignment_timeout_seconds: DEFAULT_ASSIGNMENT_TIMEOUT_SECONDS,
            max_active_deliveries_per_partner: DEFAULT_MAX_ACTIVE_DELIVERIES,
        });
    }
    return settings;
}

/**
 * Finds eligible delivery partners ranked by distance and workload
 */
async function findEligiblePartners(pharmacyId, pickupCoordinates, options = {}) {
    const settings = await getPharmacySettings(pharmacyId);
    const maxDistanceKm = options.maxRadiusKm || settings.max_assignment_radius_km || DEFAULT_MAX_RADIUS_KM;
    const maxActive = settings.max_active_deliveries_per_partner || DEFAULT_MAX_ACTIVE_DELIVERIES;
    const deliveryMode = options.deliveryMode || settings.delivery_mode || DELIVERY_MODES.BOTH;

    // Base filter for partners
    const baseQuery = {
        account_status: PARTNER_ACCOUNT_STATUS.ACTIVE,
        verification_status: PARTNER_VERIFICATION_STATUS.VERIFIED,
        is_online: true,
        is_available: true,
    };

    if (deliveryMode === DELIVERY_MODES.OWN_STAFF) {
        baseQuery.partner_type = PARTNER_TYPES.PHARMACY_STAFF;
        baseQuery.pharmacy_id = pharmacyId;
    } else if (deliveryMode === DELIVERY_MODES.PLATFORM) {
        baseQuery.partner_type = PARTNER_TYPES.PLATFORM_PARTNER;
    } else {
        // BOTH
        baseQuery.$or = [
            { partner_type: PARTNER_TYPES.PHARMACY_STAFF, pharmacy_id: pharmacyId },
            { partner_type: PARTNER_TYPES.PLATFORM_PARTNER },
        ];
    }

    // Exclude partners already offered this order
    if (options.excludePartnerIds && options.excludePartnerIds.length > 0) {
        baseQuery._id = { $nin: options.excludePartnerIds };
    }

    const partners = await DeliveryPartner.find(baseQuery);
    if (!partners || partners.length === 0) {
        return [];
    }

    // Check active workload of candidate partners
    const activeDeliveries = await Delivery.aggregate([
        {
            $match: {
                delivery_partner_id: { $in: partners.map((p) => p._id) },
                delivery_status: {
                    $in: [
                        DELIVERY_STATUS.ASSIGNED,
                        DELIVERY_STATUS.REACHED_PHARMACY,
                        DELIVERY_STATUS.PICKED_UP,
                        DELIVERY_STATUS.OUT_FOR_DELIVERY,
                        DELIVERY_STATUS.REACHED_CUSTOMER,
                    ],
                },
            },
        },
        {
            $group: {
                _id: '$delivery_partner_id',
                count: { $sum: 1 },
            },
        },
    ]);

    const activeCountMap = new Map();
    activeDeliveries.forEach((d) => activeCountMap.set(d._id.toString(), d.count));

    const scoredPartners = [];

    for (const partner of partners) {
        const activeCount = activeCountMap.get(partner._id.toString()) || 0;
        if (activeCount >= maxActive) {
            continue; // Busy
        }

        const partnerCoords = partner.current_location?.coordinates || [0, 0];
        const distKm = calculateDistanceKm(pickupCoordinates, partnerCoords);

        // Filter by radius if valid coordinates exist
        if (
            pickupCoordinates &&
            pickupCoordinates[0] !== 0 &&
            partnerCoords[0] !== 0 &&
            distKm > maxDistanceKm
        ) {
            continue; // Out of range
        }

        // Scoring: lower distance is better, lower workload is better
        // Prefer pharmacy's own staff slightly if deliveryMode is BOTH
        const staffBonus = partner.partner_type === PARTNER_TYPES.PHARMACY_STAFF ? -1.0 : 0.0;
        const score = distKm + activeCount * 1.5 + staffBonus;

        scoredPartners.push({
            partner,
            distanceKm: distKm,
            activeCount,
            score,
        });
    }

    // Rank ascending by score
    scoredPartners.sort((a, b) => a.score - b.score);

    return scoredPartners;
}

/**
 * Triggers the automatic assignment workflow for a confirmed ready order
 */
async function autoAssignOrder(orderId, triggeredByUserId = null) {
    const order = await Order.findById(orderId).populate('branch_id');
    if (!order) {
        throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    }

    const branch = order.branch_id;
    if (!branch) {
        throw new ApiError(400, 'Order branch not found', 'BRANCH_NOT_FOUND');
    }

    const settings = await getPharmacySettings(branch._id);
    if (!settings.auto_assignment_enabled) {
        return {
            success: false,
            message: 'Auto assignment is disabled for this pharmacy. Please assign manually.',
            status: 'MANUAL_REQUIRED',
        };
    }

    // Extract pickup coordinates
    let pickupCoords = branch.location?.coordinates;
    if (!pickupCoords || (pickupCoords[0] === 0 && pickupCoords[1] === 0)) {
        if (branch.longitude && branch.latitude) {
            pickupCoords = [branch.longitude, branch.latitude];
        } else {
            pickupCoords = [0, 0];
        }
    }

    // Find previously rejected or expired assignments for this order
    const previousAssignments = await DeliveryAssignment.find({
        order_id: order._id,
        assignment_status: { $in: [ASSIGNMENT_STATUS.REJECTED, ASSIGNMENT_STATUS.EXPIRED] },
    });
    const excludedPartnerIds = previousAssignments.map((a) => a.delivery_partner_id);

    // Discover candidates
    const eligible = await findEligiblePartners(branch._id, pickupCoords, {
        excludePartnerIds: excludedPartnerIds,
        deliveryMode: order.delivery_mode || settings.delivery_mode,
        maxRadiusKm: settings.max_assignment_radius_km,
    });

    if (eligible.length === 0) {
        // No candidates available right now
        order.delivery_status = 'PENDING';
        await order.save();

        emitDeliveryEvent(`pharmacy:${branch._id}`, 'delivery_failed', {
            orderId: order._id.toString(),
            orderNumber: order.order_number,
            reason: 'NO_PARTNERS_AVAILABLE',
            message: 'No available delivery partners found within the service radius.',
        });

        return {
            success: false,
            message: 'No eligible delivery partners available nearby.',
            orderId: order._id,
            status: 'NO_PARTNERS_AVAILABLE',
        };
    }

    const topCandidate = eligible[0].partner;
    const attemptCount = previousAssignments.length + 1;
    const timeoutSeconds = settings.assignment_timeout_seconds || DEFAULT_ASSIGNMENT_TIMEOUT_SECONDS;
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

    const assignment = await DeliveryAssignment.create({
        order_id: order._id,
        pharmacy_id: branch._id,
        delivery_partner_id: topCandidate._id,
        partner_type: topCandidate.partner_type,
        assignment_status: ASSIGNMENT_STATUS.OFFERED,
        assignment_method: ASSIGNMENT_METHODS.AUTO,
        offered_at: new Date(),
        expires_at: expiresAt,
        assigned_by: triggeredByUserId || null,
        assignment_attempt: attemptCount,
    });

    order.delivery_status = DELIVERY_STATUS.OFFERED;
    order.delivery_assignment_id = assignment._id;
    order.assigned_partner_id = topCandidate._id;
    await order.save();

    // Prepare offer payload
    const offerPayload = {
        assignmentId: assignment._id.toString(),
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        pharmacyName: branch.name,
        pickupAddress: branch.address,
        dropAddress: order.delivery_address || 'Customer Address',
        deliveryPhone: order.delivery_phone || '',
        netAmount: order.net_amount,
        distanceKm: eligible[0].distanceKm,
        expiresAt: expiresAt.toISOString(),
        timeoutSeconds,
    };

    // Socket.IO event to partner room
    emitDeliveryEvent(`partner:${topCandidate._id}`, 'delivery_request_new', offerPayload);

    // FCM Notification
    if (topCandidate.fcm_token) {
        sendDeliveryFCM({
            fcmToken: topCandidate.fcm_token,
            title: 'New Delivery Request 📦',
            body: `Order #${order.order_number} from ${branch.name}. Tap to accept.`,
            data: {
                type: 'delivery_request_new',
                assignmentId: assignment._id.toString(),
                orderId: order._id.toString(),
                expiresAt: expiresAt.toISOString(),
            },
        });
    }

    // Schedule background expiration checker (in production/development)
    if (process.env.NODE_ENV !== 'test') {
        setTimeout(async () => {
            try {
                await checkOfferExpiry(assignment._id);
            } catch (err) {
                console.error('Error in checkOfferExpiry timer:', err.message);
            }
        }, (timeoutSeconds + 1) * 1000);
    }

    return {
        success: true,
        message: `Delivery offered to ${topCandidate.full_name}`,
        assignmentId: assignment._id,
        partnerId: topCandidate._id,
        partnerName: topCandidate.full_name,
        expiresAt,
    };
}

/**
 * Checks and handles expiration of an offered delivery assignment
 */
async function checkOfferExpiry(assignmentId) {
    const assignment = await DeliveryAssignment.findOne({
        _id: assignmentId,
        assignment_status: ASSIGNMENT_STATUS.OFFERED,
    });

    if (!assignment) return; // Already accepted or rejected

    if (new Date() >= assignment.expires_at) {
        assignment.assignment_status = ASSIGNMENT_STATUS.EXPIRED;
        await assignment.save();

        emitDeliveryEvent(`partner:${assignment.delivery_partner_id}`, 'delivery_request_expired', {
            assignmentId: assignment._id.toString(),
            orderId: assignment.order_id.toString(),
            message: 'Delivery request expired',
        });

        // Trigger next candidate
        await autoAssignOrder(assignment.order_id);
    }
}

/**
 * Handles delivery partner accepting an offered assignment (Concurrency Protected)
 */
async function acceptOffer(assignmentId, partnerId) {
    const assignment = await DeliveryAssignment.findOneAndUpdate(
        {
            _id: assignmentId,
            delivery_partner_id: partnerId,
            assignment_status: ASSIGNMENT_STATUS.OFFERED,
            expires_at: { $gt: new Date() },
        },
        {
            $set: {
                assignment_status: ASSIGNMENT_STATUS.ACCEPTED,
                accepted_at: new Date(),
            },
        },
        { new: true }
    );

    if (!assignment) {
        throw new ApiError(
            400,
            'This delivery request is no longer available or has already expired/been accepted.',
            'OFFER_NOT_AVAILABLE'
        );
    }

    const order = await Order.findById(assignment.order_id).populate('branch_id');
    if (!order) {
        throw new ApiError(404, 'Associated order not found', 'ORDER_NOT_FOUND');
    }

    const partner = await DeliveryPartner.findById(partnerId);
    const branch = order.branch_id;

    // Generate secure 6-digit OTPs for Pickup and Delivery
    const pickupOtp = await generateOtp();
    const deliveryOtp = await generateOtp();

    // Check if delivery already exists or create new
    let delivery = await Delivery.findOne({ order_id: order._id });
    if (!delivery) {
        delivery = await Delivery.create({
            order_id: order._id,
            pharmacy_id: branch._id,
            consumer_id: order.customer_id || null,
            delivery_partner_id: partner._id,
            pickup_location: {
                pharmacy_name: branch.name,
                contact_phone: branch.contact_number,
                address: branch.address,
                location: branch.location || { type: 'Point', coordinates: [0, 0] },
            },
            drop_location: {
                customer_name: order.delivery_phone || 'Customer',
                contact_phone: order.delivery_phone || '',
                address: order.delivery_address || 'Customer Address',
                city: order.delivery_city || '',
                pincode: order.delivery_pincode || '',
                location: order.drop_location?.location || { type: 'Point', coordinates: [0, 0] },
            },
            current_location: partner.current_location || { type: 'Point', coordinates: [0, 0] },
            delivery_status: DELIVERY_STATUS.ASSIGNED,
            pickup_otp_hash: pickupOtp.hash,
            delivery_otp_hash: deliveryOtp.hash,
        });
    } else {
        delivery.delivery_partner_id = partner._id;
        delivery.delivery_status = DELIVERY_STATUS.ASSIGNED;
        delivery.pickup_otp_hash = pickupOtp.hash;
        delivery.delivery_otp_hash = deliveryOtp.hash;
        await delivery.save();
    }

    // Update Order delivery status
    order.delivery_status = DELIVERY_STATUS.ASSIGNED;
    order.assigned_partner_id = partner._id;
    order.delivery_assignment_id = assignment._id;
    await order.save();

    // Synchronize PharmacyOrder if present
    const legacyOrder = await PharmacyOrder.findOne({ orderNumber: order.order_number });
    if (legacyOrder) {
        legacyOrder.deliveryPartner = {
            name: partner.full_name,
            contact: partner.mobile,
            partnerId: partner._id,
        };
        legacyOrder.deliveryId = delivery._id;
        legacyOrder.deliveryStatus = DELIVERY_STATUS.ASSIGNED;
        await legacyOrder.save();
    }

    const eventPayload = {
        deliveryId: delivery._id.toString(),
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        partnerId: partner._id.toString(),
        partnerName: partner.full_name,
        partnerPhone: partner.mobile,
        pickupOtpCode: pickupOtp.code, // Shared with pharmacy via socket/response
        deliveryStatus: DELIVERY_STATUS.ASSIGNED,
    };

    // Emit Socket events
    emitDeliveryEvent(`pharmacy:${branch._id}`, 'delivery_request_accepted', eventPayload);
    emitDeliveryEvent(`partner:${partner._id}`, 'delivery_assigned', eventPayload);
    if (order.customer_id) {
        emitDeliveryEvent(`consumer:${order.customer_id}`, 'delivery_assigned', {
            orderId: order._id.toString(),
            partnerName: partner.full_name,
            deliveryStatus: DELIVERY_STATUS.ASSIGNED,
        });
    }

    return {
        delivery,
        assignment,
        pickupOtp: pickupOtp.code,
        deliveryOtp: deliveryOtp.code,
    };
}

/**
 * Handles delivery partner rejecting an offered assignment
 */
async function rejectOffer(assignmentId, partnerId, reason = null) {
    const assignment = await DeliveryAssignment.findOneAndUpdate(
        {
            _id: assignmentId,
            delivery_partner_id: partnerId,
            assignment_status: ASSIGNMENT_STATUS.OFFERED,
        },
        {
            $set: {
                assignment_status: ASSIGNMENT_STATUS.REJECTED,
                rejected_at: new Date(),
                rejection_reason: reason || 'Declined by partner',
            },
        },
        { new: true }
    );

    if (!assignment) {
        throw new ApiError(404, 'Offer not found or already processed', 'OFFER_NOT_FOUND');
    }

    emitDeliveryEvent(`partner:${partnerId}`, 'delivery_request_rejected', {
        assignmentId: assignment._id.toString(),
        orderId: assignment.order_id.toString(),
        reason: assignment.rejection_reason,
    });

    // Re-trigger auto assignment for next candidate
    setImmediate(async () => {
        try {
            await autoAssignOrder(assignment.order_id);
        } catch (err) {
            console.error('Error auto assigning next candidate:', err.message);
        }
    });

    return assignment;
}

/**
 * Manually assigns a specific partner to an order by pharmacy staff/owner
 */
async function manualAssign(orderId, partnerId, assignedByUserId) {
    const order = await Order.findById(orderId).populate('branch_id');
    if (!order) {
        throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
    }

    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) {
        throw new ApiError(404, 'Delivery partner not found', 'PARTNER_NOT_FOUND');
    }

    if (partner.account_status !== PARTNER_ACCOUNT_STATUS.ACTIVE) {
        throw new ApiError(400, 'Selected delivery partner account is not active', 'PARTNER_NOT_ACTIVE');
    }

    const orderBranchId = order.branch_id?._id
        ? order.branch_id._id.toString()
        : order.branch_id
        ? order.branch_id.toString()
        : null;

    if (
        partner.partner_type === PARTNER_TYPES.PHARMACY_STAFF &&
        partner.pharmacy_id?.toString() !== orderBranchId
    ) {
        throw new ApiError(
            403,
            'This delivery staff belongs to a different pharmacy and cannot be assigned.',
            'STAFF_PHARMACY_MISMATCH'
        );
    }

    const branch = order.branch_id;
    const pickupOtp = await generateOtp();
    const deliveryOtp = await generateOtp();

    const assignment = await DeliveryAssignment.create({
        order_id: order._id,
        pharmacy_id: branch._id,
        delivery_partner_id: partner._id,
        partner_type: partner.partner_type,
        assignment_status: ASSIGNMENT_STATUS.ACCEPTED,
        assignment_method: ASSIGNMENT_METHODS.MANUAL,
        offered_at: new Date(),
        expires_at: new Date(Date.now() + 3600 * 1000),
        accepted_at: new Date(),
        assigned_by: assignedByUserId,
        assignment_attempt: 1,
    });

    let delivery = await Delivery.findOne({ order_id: order._id });
    if (!delivery) {
        delivery = await Delivery.create({
            order_id: order._id,
            pharmacy_id: branch._id,
            consumer_id: order.customer_id || null,
            delivery_partner_id: partner._id,
            pickup_location: {
                pharmacy_name: branch.name,
                contact_phone: branch.contact_number,
                address: branch.address,
                location: branch.location || { type: 'Point', coordinates: [0, 0] },
            },
            drop_location: {
                customer_name: order.delivery_phone || 'Customer',
                contact_phone: order.delivery_phone || '',
                address: order.delivery_address || 'Customer Address',
                city: order.delivery_city || '',
                pincode: order.delivery_pincode || '',
                location: order.drop_location?.location || { type: 'Point', coordinates: [0, 0] },
            },
            current_location: partner.current_location || { type: 'Point', coordinates: [0, 0] },
            delivery_status: DELIVERY_STATUS.ASSIGNED,
            pickup_otp_hash: pickupOtp.hash,
            delivery_otp_hash: deliveryOtp.hash,
        });
    } else {
        delivery.delivery_partner_id = partner._id;
        delivery.delivery_status = DELIVERY_STATUS.ASSIGNED;
        delivery.pickup_otp_hash = pickupOtp.hash;
        delivery.delivery_otp_hash = deliveryOtp.hash;
        await delivery.save();
    }

    order.delivery_status = DELIVERY_STATUS.ASSIGNED;
    order.assigned_partner_id = partner._id;
    order.delivery_assignment_id = assignment._id;
    await order.save();

    const eventPayload = {
        deliveryId: delivery._id.toString(),
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        partnerId: partner._id.toString(),
        partnerName: partner.full_name,
        pickupOtpCode: pickupOtp.code,
        deliveryOtpCode: deliveryOtp.code,
        deliveryStatus: DELIVERY_STATUS.ASSIGNED,
    };

    emitDeliveryEvent(`partner:${partner._id}`, 'delivery_assigned', eventPayload);
    emitDeliveryEvent(`pharmacy:${branch._id}`, 'delivery_assigned', eventPayload);

    return { delivery, assignment, pickupOtp: pickupOtp.code, deliveryOtp: deliveryOtp.code };
}

module.exports = {
    calculateDistanceKm,
    generateOtp,
    getPharmacySettings,
    findEligiblePartners,
    autoAssignOrder,
    checkOfferExpiry,
    acceptOffer,
    rejectOffer,
    manualAssign,
};
