const {
    DeliveryPartner,
    DeliveryAssignment,
    Delivery,
    DeliveryEarning,
} = require('../../models/delivery');
const {
    PARTNER_ACCOUNT_STATUS,
    PARTNER_VERIFICATION_STATUS,
    DELIVERY_STATUS,
} = require('../../config/deliveryConstants');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

// GET /api/admin/delivery/partners
const getAllPartners = asyncHandler(async (req, res) => {
    const { partner_type, verification_status, account_status, is_online, page = 1, limit = 20, search } = req.query;

    const query = {};
    if (partner_type) query.partner_type = partner_type;
    if (verification_status) query.verification_status = verification_status;
    if (account_status) query.account_status = account_status;
    if (is_online !== undefined) query.is_online = is_online === 'true' || is_online === true;

    if (search) {
        query.$or = [
            { full_name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { mobile: { $regex: search, $options: 'i' } },
            { partner_code: { $regex: search, $options: 'i' } },
        ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [partners, total] = await Promise.all([
        DeliveryPartner.find(query)
            .populate('pharmacy_id', 'name code address')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limitNum),
        DeliveryPartner.countDocuments(query),
    ]);

    res.status(200).json({
        success: true,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
        data: partners,
    });
});

// GET /api/admin/delivery/partners/:partnerId
const getPartnerById = asyncHandler(async (req, res) => {
    const partner = await DeliveryPartner.findById(req.params.partnerId)
        .populate('pharmacy_id', 'name code address contact_number');

    if (!partner) {
        throw new ApiError(404, 'Delivery partner not found', 'PARTNER_NOT_FOUND');
    }

    const deliveriesCount = await Delivery.countDocuments({ delivery_partner_id: partner._id });
    const earningsTotal = await DeliveryEarning.aggregate([
        { $match: { partner_id: partner._id } },
        { $group: { _id: null, total: { $sum: '$net_amount' } } },
    ]);

    res.status(200).json({
        success: true,
        data: {
            partner,
            stats: {
                total_deliveries: deliveriesCount,
                total_earnings: earningsTotal[0]?.total || 0,
            },
        },
    });
});

// PUT /api/admin/delivery/partners/:partnerId/verify
const verifyPartner = asyncHandler(async (req, res) => {
    const { status, remarks, kyc_doc_ids } = req.body;

    if (!status || !Object.values(PARTNER_VERIFICATION_STATUS).includes(status)) {
        throw new ApiError(400, 'Valid verification status required (VERIFIED, REJECTED, UNDER_REVIEW, PENDING)', 'INVALID_STATUS');
    }

    const partner = await DeliveryPartner.findById(req.params.partnerId);
    if (!partner) {
        throw new ApiError(404, 'Delivery partner not found', 'PARTNER_NOT_FOUND');
    }

    partner.verification_status = status;
    if (remarks !== undefined) partner.verification_remarks = remarks;

    // Verify individual documents if array of doc ids supplied
    if (Array.isArray(kyc_doc_ids)) {
        partner.kyc_documents.forEach((doc) => {
            if (kyc_doc_ids.includes(doc._id.toString())) {
                doc.verified = status === PARTNER_VERIFICATION_STATUS.VERIFIED;
                doc.verified_at = new Date();
            }
        });
    }

    await partner.save();

    res.status(200).json({
        success: true,
        message: `Partner verification status updated to ${status}`,
        data: partner,
    });
});

// PUT /api/admin/delivery/partners/:partnerId/status
const updatePartnerStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status || !Object.values(PARTNER_ACCOUNT_STATUS).includes(status)) {
        throw new ApiError(400, 'Valid account status required (ACTIVE, INACTIVE, SUSPENDED, BLOCKED)', 'INVALID_STATUS');
    }

    const partner = await DeliveryPartner.findById(req.params.partnerId);
    if (!partner) {
        throw new ApiError(404, 'Delivery partner not found', 'PARTNER_NOT_FOUND');
    }

    partner.account_status = status;
    if (status !== PARTNER_ACCOUNT_STATUS.ACTIVE) {
        partner.is_online = false;
    }
    await partner.save();

    res.status(200).json({
        success: true,
        message: `Partner account status updated to ${status}`,
        data: partner,
    });
});

// POST /api/admin/delivery/partners/:partnerId/suspend
const suspendPartner = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    const partner = await DeliveryPartner.findById(req.params.partnerId);
    if (!partner) {
        throw new ApiError(404, 'Delivery partner not found', 'PARTNER_NOT_FOUND');
    }

    partner.account_status = PARTNER_ACCOUNT_STATUS.SUSPENDED;
    partner.is_online = false;
    if (reason) partner.verification_remarks = `Suspended: ${reason}`;
    await partner.save();

    // Cancel any active offered assignments
    await DeliveryAssignment.updateMany(
        {
            delivery_partner_id: partner._id,
            assignment_status: 'OFFERED',
        },
        { $set: { assignment_status: 'CANCELLED' } }
    );

    res.status(200).json({
        success: true,
        message: 'Delivery partner suspended successfully',
        data: partner,
    });
});

// GET /api/admin/delivery/assignments
const getAllAssignments = asyncHandler(async (req, res) => {
    const { status, partner_id, order_id, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.assignment_status = status;
    if (partner_id) query.delivery_partner_id = partner_id;
    if (order_id) query.order_id = order_id;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [assignments, total] = await Promise.all([
        DeliveryAssignment.find(query)
            .populate('delivery_partner_id', 'full_name mobile partner_type')
            .populate('pharmacy_id', 'name code')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limitNum),
        DeliveryAssignment.countDocuments(query),
    ]);

    res.status(200).json({
        success: true,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
        data: assignments,
    });
});

// GET /api/admin/delivery/analytics
const getDeliveryAnalytics = asyncHandler(async (req, res) => {
    const [
        totalPartners,
        activePartners,
        onlinePartners,
        platformPartners,
        staffPartners,
        totalDeliveries,
        deliveredCount,
        failedCount,
        totalSettlements,
    ] = await Promise.all([
        DeliveryPartner.countDocuments(),
        DeliveryPartner.countDocuments({ account_status: PARTNER_ACCOUNT_STATUS.ACTIVE }),
        DeliveryPartner.countDocuments({ is_online: true }),
        DeliveryPartner.countDocuments({ partner_type: 'PLATFORM_PARTNER' }),
        DeliveryPartner.countDocuments({ partner_type: 'PHARMACY_STAFF' }),
        Delivery.countDocuments(),
        Delivery.countDocuments({ delivery_status: DELIVERY_STATUS.DELIVERED }),
        Delivery.countDocuments({ delivery_status: DELIVERY_STATUS.FAILED }),
        DeliveryEarning.aggregate([
            { $group: { _id: null, total: { $sum: '$net_amount' } } },
        ]),
    ]);

    res.status(200).json({
        success: true,
        data: {
            partners: {
                total: totalPartners,
                active: activePartners,
                online: onlinePartners,
                platform: platformPartners,
                staff: staffPartners,
            },
            deliveries: {
                total: totalDeliveries,
                delivered: deliveredCount,
                failed: failedCount,
                success_rate: totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 100) : 100,
            },
            earnings: {
                total_settled: totalSettlements[0]?.total || 0,
            },
        },
    });
});

module.exports = {
    getAllPartners,
    getPartnerById,
    verifyPartner,
    updatePartnerStatus,
    suspendPartner,
    getAllAssignments,
    getDeliveryAnalytics,
};

