const { DeliveryPartner, DeliveryEarning } = require('../../models/delivery');
const {
    PARTNER_ACCOUNT_STATUS,
    PARTNER_VERIFICATION_STATUS,
} = require('../../config/deliveryConstants');
const { updatePartnerLocation } = require('../../services/delivery/deliveryTrackingService');
const { emitDeliveryEvent } = require('../../socket/deliveryEvents');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

// PUT /api/delivery/availability
const updateAvailability = asyncHandler(async (req, res) => {
    const { is_online, is_available } = req.body;
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id);

    // Business rule: Only verified and active partners can toggle online
    if (is_online === true) {
        if (partner.verification_status !== PARTNER_VERIFICATION_STATUS.VERIFIED) {
            throw new ApiError(
                403,
                'Your account KYC is not verified yet. You cannot go online until an admin approves your profile.',
                'KYC_NOT_VERIFIED'
            );
        }
        if (partner.account_status !== PARTNER_ACCOUNT_STATUS.ACTIVE) {
            throw new ApiError(
                403,
                `Cannot go online. Account status is ${partner.account_status}.`,
                'ACCOUNT_NOT_ACTIVE'
            );
        }
    }

    if (is_online !== undefined) {
        partner.is_online = Boolean(is_online);
        const eventName = partner.is_online ? 'delivery_partner_online' : 'delivery_partner_offline';
        emitDeliveryEvent(null, eventName, {
            partnerId: partner._id.toString(),
            partnerName: partner.full_name,
            partnerType: partner.partner_type,
            pharmacyId: partner.pharmacy_id,
        });
    }

    if (is_available !== undefined) {
        partner.is_available = Boolean(is_available);
    }

    await partner.save();

    res.status(200).json({
        success: true,
        message: `Availability updated. You are now ${partner.is_online ? 'ONLINE' : 'OFFLINE'}.`,
        data: {
            is_online: partner.is_online,
            is_available: partner.is_available,
        },
    });
});

// POST /api/delivery/location/update
const updateLocation = asyncHandler(async (req, res) => {
    const { latitude, longitude, heading, speed, accuracy } = req.body;

    const result = await updatePartnerLocation(req.deliveryPartner._id, {
        latitude,
        longitude,
        heading,
        speed,
        accuracy,
    });

    res.status(200).json({
        success: true,
        message: 'Location updated',
        data: result,
    });
});

// GET /api/delivery/location/current
const getCurrentLocation = asyncHandler(async (req, res) => {
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id);

    res.status(200).json({
        success: true,
        data: {
            location: partner.current_location,
            last_location_updated_at: partner.last_location_updated_at,
        },
    });
});

// GET /api/delivery/earnings/summary
const getEarningsSummary = asyncHandler(async (req, res) => {
    const partnerId = req.deliveryPartner._id;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

    const [todayEarnings, weekEarnings, totalEarnings] = await Promise.all([
        DeliveryEarning.aggregate([
            { $match: { partner_id: partnerId, created_at: { $gte: startOfToday } } },
            { $group: { _id: null, total: { $sum: '$net_amount' }, count: { $sum: 1 } } },
        ]),
        DeliveryEarning.aggregate([
            { $match: { partner_id: partnerId, created_at: { $gte: startOfWeek } } },
            { $group: { _id: null, total: { $sum: '$net_amount' }, count: { $sum: 1 } } },
        ]),
        DeliveryEarning.aggregate([
            { $match: { partner_id: partnerId } },
            { $group: { _id: null, total: { $sum: '$net_amount' }, count: { $sum: 1 } } },
        ]),
    ]);

    const recentEarnings = await DeliveryEarning.find({ partner_id: partnerId })
        .sort({ created_at: -1 })
        .limit(10);

    res.status(200).json({
        success: true,
        data: {
            today: {
                amount: todayEarnings[0]?.total || 0,
                deliveries: todayEarnings[0]?.count || 0,
            },
            this_week: {
                amount: weekEarnings[0]?.total || 0,
                deliveries: weekEarnings[0]?.count || 0,
            },
            total: {
                amount: totalEarnings[0]?.total || 0,
                deliveries: totalEarnings[0]?.count || 0,
            },
            recent: recentEarnings,
        },
    });
});

module.exports = {
    updateAvailability,
    updateLocation,
    getCurrentLocation,
    getEarningsSummary,
};

