const {
    DeliveryAssignment,
    Delivery,
} = require('../../models/delivery');
const {
    ASSIGNMENT_STATUS,
    DELIVERY_STATUS,
} = require('../../config/deliveryConstants');
const {
    acceptOffer,
    rejectOffer,
} = require('../../services/delivery/deliveryAssignmentService');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

// GET /api/delivery/requests
const getRequests = asyncHandler(async (req, res) => {
    const partnerId = req.deliveryPartner._id;

    const offers = await DeliveryAssignment.find({
        delivery_partner_id: partnerId,
        assignment_status: ASSIGNMENT_STATUS.OFFERED,
        expires_at: { $gt: new Date() },
    })
        .populate('pharmacy_id', 'name address contact_number location')
        .sort({ offered_at: -1 });

    res.status(200).json({
        success: true,
        count: offers.length,
        data: offers,
    });
});

// GET /api/delivery/requests/:requestId
const getRequestById = asyncHandler(async (req, res) => {
    const offer = await DeliveryAssignment.findOne({
        _id: req.params.requestId,
        delivery_partner_id: req.deliveryPartner._id,
    }).populate('pharmacy_id', 'name address contact_number location');

    if (!offer) {
        throw new ApiError(404, 'Delivery request not found', 'REQUEST_NOT_FOUND');
    }

    res.status(200).json({
        success: true,
        data: offer,
    });
});

// POST /api/delivery/requests/:requestId/accept
const acceptRequest = asyncHandler(async (req, res) => {
    const result = await acceptOffer(req.params.requestId, req.deliveryPartner._id);

    res.status(200).json({
        success: true,
        message: 'Delivery request accepted',
        data: {
            delivery: result.delivery,
            assignment: result.assignment,
        },
    });
});

// POST /api/delivery/requests/:requestId/reject
const rejectRequest = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const assignment = await rejectOffer(req.params.requestId, req.deliveryPartner._id, reason);

    res.status(200).json({
        success: true,
        message: 'Delivery request declined',
        data: assignment,
    });
});

// GET /api/delivery/active
const getActiveDelivery = asyncHandler(async (req, res) => {
    const activeDelivery = await Delivery.findOne({
        delivery_partner_id: req.deliveryPartner._id,
        delivery_status: {
            $in: [
                DELIVERY_STATUS.ASSIGNED,
                DELIVERY_STATUS.REACHED_PHARMACY,
                DELIVERY_STATUS.PICKED_UP,
                DELIVERY_STATUS.OUT_FOR_DELIVERY,
                DELIVERY_STATUS.REACHED_CUSTOMER,
            ],
        },
    }).populate('pharmacy_id', 'name address contact_number location');

    res.status(200).json({
        success: true,
        data: activeDelivery || null,
    });
});

// GET /api/delivery/history
const getDeliveryHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query = { delivery_partner_id: req.deliveryPartner._id };
    if (status) {
        query.delivery_status = status;
    } else {
        query.delivery_status = {
            $in: [DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.FAILED, DELIVERY_STATUS.RETURNED],
        };
    }

    const [deliveries, total] = await Promise.all([
        Delivery.find(query)
            .populate('pharmacy_id', 'name address')
            .sort({ delivered_at: -1, created_at: -1 })
            .skip(skip)
            .limit(limitNum),
        Delivery.countDocuments(query),
    ]);

    res.status(200).json({
        success: true,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
        data: deliveries,
    });
});

module.exports = {
    getRequests,
    getRequestById,
    acceptRequest,
    rejectRequest,
    getActiveDelivery,
    getDeliveryHistory,
};

