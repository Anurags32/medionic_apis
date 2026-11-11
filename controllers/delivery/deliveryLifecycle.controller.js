const deliveryService = require('../../services/delivery/deliveryService');
const { getDeliveryLocationHistory } = require('../../services/delivery/deliveryTrackingService');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

// POST /api/delivery/:deliveryId/reached-pharmacy
const reachedPharmacy = asyncHandler(async (req, res) => {
    const delivery = await deliveryService.reachedPharmacy(req.params.deliveryId, req.deliveryPartner._id);
    res.status(200).json({
        success: true,
        message: 'Status updated: Partner reached pharmacy',
        data: delivery,
    });
});

// POST /api/delivery/:deliveryId/verify-pickup-otp
const verifyPickupOtp = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    if (!otp) {
        throw new ApiError(400, 'OTP code is required', 'OTP_REQUIRED');
    }

    const result = await deliveryService.verifyPickupOtp(req.params.deliveryId, req.deliveryPartner._id, otp);
    res.status(200).json(result);
});

// POST /api/delivery/:deliveryId/pickup-confirm
const pickupConfirm = asyncHandler(async (req, res) => {
    const { image_url, notes, signature_url } = req.body;
    const delivery = await deliveryService.pickupConfirm(req.params.deliveryId, req.deliveryPartner._id, {
        image_url,
        notes,
        signature_url,
    });

    res.status(200).json({
        success: true,
        message: 'Order pickup confirmed',
        data: delivery,
    });
});

// POST /api/delivery/:deliveryId/start-delivery
const startDelivery = asyncHandler(async (req, res) => {
    const delivery = await deliveryService.startDelivery(req.params.deliveryId, req.deliveryPartner._id);
    res.status(200).json({
        success: true,
        message: 'Delivery transit journey started',
        data: delivery,
    });
});

// POST /api/delivery/:deliveryId/reached-customer
const reachedCustomer = asyncHandler(async (req, res) => {
    const delivery = await deliveryService.reachedCustomer(req.params.deliveryId, req.deliveryPartner._id);
    res.status(200).json({
        success: true,
        message: 'Partner reached customer location',
        data: delivery,
    });
});

// POST /api/delivery/:deliveryId/verify-delivery-otp
const verifyDeliveryOtp = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    if (!otp) {
        throw new ApiError(400, 'OTP code is required', 'OTP_REQUIRED');
    }

    const result = await deliveryService.verifyDeliveryOtp(req.params.deliveryId, req.deliveryPartner._id, otp);
    res.status(200).json(result);
});

// POST /api/delivery/:deliveryId/complete
const completeDelivery = asyncHandler(async (req, res) => {
    const { image_url, notes, signature_url } = req.body;
    const result = await deliveryService.completeDelivery(req.params.deliveryId, req.deliveryPartner._id, {
        image_url,
        notes,
        signature_url,
    });

    res.status(200).json({
        success: true,
        message: 'Delivery successfully completed',
        data: result,
    });
});

// POST /api/delivery/:deliveryId/fail
const failDelivery = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const delivery = await deliveryService.failDelivery(req.params.deliveryId, req.deliveryPartner._id, reason);

    res.status(200).json({
        success: true,
        message: 'Delivery marked as failed',
        data: delivery,
    });
});

// POST /api/delivery/:deliveryId/return
const returnDelivery = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const delivery = await deliveryService.returnDelivery(req.params.deliveryId, req.deliveryPartner._id, reason);

    res.status(200).json({
        success: true,
        message: 'Delivery marked as returned to pharmacy',
        data: delivery,
    });
});

// GET /api/delivery/:deliveryId/tracking
const getTracking = asyncHandler(async (req, res) => {
    const delivery = await deliveryService.getDeliveryTracking(req.params.deliveryId, req.deliveryPartner);
    const breadcrumbs = await getDeliveryLocationHistory(delivery._id);

    res.status(200).json({
        success: true,
        data: {
            delivery,
            breadcrumbs,
        },
    });
});

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
    getTracking,
};

