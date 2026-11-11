const { DeliveryPartner, Delivery } = require('../../models/delivery');
const {
    PARTNER_VERIFICATION_STATUS,
    DELIVERY_STATUS,
} = require('../../config/deliveryConstants');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

// GET /api/delivery/profile
const getProfile = asyncHandler(async (req, res) => {
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id)
        .populate('pharmacy_id', 'name code address contact_number');

    res.status(200).json({
        success: true,
        data: partner,
    });
});

// PUT /api/delivery/profile
const updateProfile = asyncHandler(async (req, res) => {
    const { full_name, profile_image, working_hours } = req.body;
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id);

    if (full_name) partner.full_name = full_name.trim();
    if (profile_image !== undefined) partner.profile_image = profile_image;
    if (working_hours) partner.working_hours = working_hours;

    await partner.save();

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: partner,
    });
});

// POST /api/delivery/kyc/upload
const uploadKyc = asyncHandler(async (req, res) => {
    const { doc_type, doc_number, doc_url } = req.body;

    if (!doc_type || !doc_url) {
        throw new ApiError(400, 'doc_type and doc_url are required', 'KYC_DATA_REQUIRED');
    }

    const partner = await DeliveryPartner.findById(req.deliveryPartner._id);

    // Push new KYC doc
    partner.kyc_documents.push({
        doc_type,
        doc_number: doc_number ? doc_number.trim() : null,
        doc_url,
        verified: false,
    });

    // Move verification status to UNDER_REVIEW
    if (partner.verification_status === PARTNER_VERIFICATION_STATUS.PENDING) {
        partner.verification_status = PARTNER_VERIFICATION_STATUS.UNDER_REVIEW;
    }

    await partner.save();

    res.status(201).json({
        success: true,
        message: 'KYC document uploaded successfully and submitted for review',
        data: partner.kyc_documents,
    });
});

// GET /api/delivery/kyc/status
const getKycStatus = asyncHandler(async (req, res) => {
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id);

    res.status(200).json({
        success: true,
        data: {
            verification_status: partner.verification_status,
            verification_remarks: partner.verification_remarks,
            kyc_documents: partner.kyc_documents,
            license_document: partner.license_document,
        },
    });
});

// PUT /api/delivery/vehicle
const updateVehicle = asyncHandler(async (req, res) => {
    const { vehicle_type, vehicle_number, license_number, license_doc_url, license_expiry } = req.body;
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id);

    if (vehicle_type) partner.vehicle_type = vehicle_type;
    if (vehicle_number !== undefined) partner.vehicle_number = vehicle_number ? vehicle_number.trim().toUpperCase() : null;

    if (license_number || license_doc_url) {
        partner.license_document = {
            license_number: license_number || partner.license_document?.license_number,
            doc_url: license_doc_url || partner.license_document?.doc_url,
            expiry_date: license_expiry ? new Date(license_expiry) : partner.license_document?.expiry_date,
        };
    }

    await partner.save();

    res.status(200).json({
        success: true,
        message: 'Vehicle and license details updated',
        data: {
            vehicle_type: partner.vehicle_type,
            vehicle_number: partner.vehicle_number,
            license_document: partner.license_document,
        },
    });
});

// GET /api/delivery/account/status
const getAccountStatus = asyncHandler(async (req, res) => {
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id);

    const activeDeliveriesCount = await Delivery.countDocuments({
        delivery_partner_id: partner._id,
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

    res.status(200).json({
        success: true,
        data: {
            account_status: partner.account_status,
            verification_status: partner.verification_status,
            is_online: partner.is_online,
            is_available: partner.is_available,
            active_deliveries_count: activeDeliveriesCount,
            rating: partner.rating,
            total_deliveries: partner.total_deliveries,
        },
    });
});

module.exports = {
    getProfile,
    updateProfile,
    uploadKyc,
    getKycStatus,
    updateVehicle,
    getAccountStatus,
};

