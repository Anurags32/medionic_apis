const bcrypt = require('bcryptjs');
const {
    DeliveryPartner,
    PharmacyDeliverySettings,
    DeliveryAssignment,
    Delivery,
} = require('../../models/delivery');
const Order = require('../../models/pharmacy/order.model');
const Branch = require('../../models/pharmacy/branch.model');
const {
    PARTNER_TYPES,
    PARTNER_ACCOUNT_STATUS,
    PARTNER_VERIFICATION_STATUS,
    ASSIGNMENT_STATUS,
    DELIVERY_STATUS,
} = require('../../config/deliveryConstants');
const {
    getPharmacySettings,
    findEligiblePartners,
    autoAssignOrder,
    manualAssign,
} = require('../../services/delivery/deliveryAssignmentService');
const { emitDeliveryEvent } = require('../../socket/deliveryEvents');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');

// Helper to resolve branch ID from authenticated pharmacy user or request
function getBranchId(req) {
    const branchId =
        req.user?.branchId ||
        req.user?.branch_id ||
        req.body?.branch_id ||
        req.query?.branch_id ||
        req.params?.branch_id;
    if (!branchId) {
        throw new ApiError(400, 'Branch context is required', 'BRANCH_REQUIRED');
    }
    return branchId;
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP F: Pharmacy Staff Management
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/pharmacy/delivery-staff
const createDeliveryStaff = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const { full_name, email, mobile, password, employee_id, vehicle_type, vehicle_number } = req.body;

    if (!full_name || !email || !mobile || !password) {
        throw new ApiError(400, 'Full name, email, mobile, and password are required', 'FIELDS_REQUIRED');
    }

    const existingEmail = await DeliveryPartner.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
        throw new ApiError(409, 'Email already in use', 'EMAIL_EXISTS');
    }

    const existingMobile = await DeliveryPartner.findOne({ mobile: mobile.trim() });
    if (existingMobile) {
        throw new ApiError(409, 'Mobile already in use', 'MOBILE_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const partner_code = await DeliveryPartner.generatePartnerCode(PARTNER_TYPES.PHARMACY_STAFF);

    const staff = await DeliveryPartner.create({
        partner_code,
        partner_type: PARTNER_TYPES.PHARMACY_STAFF,
        pharmacy_id: branchId,
        full_name: full_name.trim(),
        email: email.toLowerCase().trim(),
        mobile: mobile.trim(),
        password_hash,
        employee_id: employee_id ? employee_id.trim() : null,
        vehicle_type: vehicle_type || 'MOTORCYCLE',
        vehicle_number: vehicle_number ? vehicle_number.trim().toUpperCase() : null,
        verification_status: PARTNER_VERIFICATION_STATUS.VERIFIED, // Pharmacy owner invited staff are verified
        account_status: PARTNER_ACCOUNT_STATUS.ACTIVE,
        is_online: false,
        is_available: true,
    });

    res.status(201).json({
        success: true,
        message: 'Pharmacy delivery staff created successfully',
        data: staff,
    });
});

// GET /api/pharmacy/delivery-staff
const getDeliveryStaff = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const staff = await DeliveryPartner.find({
        pharmacy_id: branchId,
        partner_type: PARTNER_TYPES.PHARMACY_STAFF,
    }).sort({ created_at: -1 });

    res.status(200).json({
        success: true,
        count: staff.length,
        data: staff,
    });
});

// GET /api/pharmacy/delivery-staff/:staffId
const getDeliveryStaffById = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const staff = await DeliveryPartner.findOne({
        _id: req.params.staffId,
        pharmacy_id: branchId,
    });

    if (!staff) {
        throw new ApiError(404, 'Delivery staff not found in this pharmacy', 'STAFF_NOT_FOUND');
    }

    res.status(200).json({
        success: true,
        data: staff,
    });
});

// PUT /api/pharmacy/delivery-staff/:staffId
const updateDeliveryStaff = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const staff = await DeliveryPartner.findOne({
        _id: req.params.staffId,
        pharmacy_id: branchId,
    });

    if (!staff) {
        throw new ApiError(404, 'Delivery staff not found in this pharmacy', 'STAFF_NOT_FOUND');
    }

    const { full_name, mobile, employee_id, vehicle_type, vehicle_number } = req.body;
    if (full_name) staff.full_name = full_name.trim();
    if (mobile) staff.mobile = mobile.trim();
    if (employee_id !== undefined) staff.employee_id = employee_id ? employee_id.trim() : null;
    if (vehicle_type) staff.vehicle_type = vehicle_type;
    if (vehicle_number !== undefined) staff.vehicle_number = vehicle_number ? vehicle_number.trim().toUpperCase() : null;

    await staff.save();

    res.status(200).json({
        success: true,
        message: 'Delivery staff updated successfully',
        data: staff,
    });
});

// PUT /api/pharmacy/delivery-staff/:staffId/status
const updateDeliveryStaffStatus = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const { status } = req.body;

    if (!status || !Object.values(PARTNER_ACCOUNT_STATUS).includes(status)) {
        throw new ApiError(400, 'Valid status is required (ACTIVE, INACTIVE, SUSPENDED, BLOCKED)', 'INVALID_STATUS');
    }

    const staff = await DeliveryPartner.findOne({
        _id: req.params.staffId,
        pharmacy_id: branchId,
    });

    if (!staff) {
        throw new ApiError(404, 'Delivery staff not found in this pharmacy', 'STAFF_NOT_FOUND');
    }

    staff.account_status = status;
    if (status !== PARTNER_ACCOUNT_STATUS.ACTIVE) {
        staff.is_online = false;
    }
    await staff.save();

    res.status(200).json({
        success: true,
        message: `Delivery staff status updated to ${status}`,
        data: staff,
    });
});

// DELETE /api/pharmacy/delivery-staff/:staffId
const deleteDeliveryStaff = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const staff = await DeliveryPartner.findOne({
        _id: req.params.staffId,
        pharmacy_id: branchId,
    });

    if (!staff) {
        throw new ApiError(404, 'Delivery staff not found in this pharmacy', 'STAFF_NOT_FOUND');
    }

    // Soft delete / deactivate
    staff.account_status = PARTNER_ACCOUNT_STATUS.INACTIVE;
    staff.is_online = false;
    await staff.save();

    res.status(200).json({
        success: true,
        message: 'Delivery staff deactivated successfully',
    });
});

// POST /api/pharmacy/delivery-staff/:staffId/resend-invitation
const resendStaffInvitation = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const staff = await DeliveryPartner.findOne({
        _id: req.params.staffId,
        pharmacy_id: branchId,
    });

    if (!staff) {
        throw new ApiError(404, 'Delivery staff not found in this pharmacy', 'STAFF_NOT_FOUND');
    }

    // Generate a temporary 6-digit access code for invitation
    const tempCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    staff.password_hash = await bcrypt.hash(tempCode, salt);
    await staff.save();

    res.status(200).json({
        success: true,
        message: 'Invitation resent to delivery staff',
        data: {
            staffId: staff._id,
            email: staff.email,
            tempCode: process.env.NODE_ENV !== 'production' ? tempCode : undefined,
        },
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUP G: Pharmacy Delivery Assignment
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/pharmacy/delivery/settings
const getSettings = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const settings = await getPharmacySettings(branchId);

    res.status(200).json({
        success: true,
        data: settings,
    });
});

// PUT /api/pharmacy/delivery/settings
const updateSettings = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const settings = await getPharmacySettings(branchId);

    const allowedFields = [
        'delivery_mode',
        'enable_platform_delivery',
        'enable_own_staff_delivery',
        'auto_assignment_enabled',
        'manual_assignment_enabled',
        'max_assignment_radius_km',
        'assignment_timeout_seconds',
        'max_active_deliveries_per_partner',
        'delivery_charges_configuration',
        'working_hours',
    ];

    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            settings[field] = req.body[field];
        }
    });

    await settings.save();

    res.status(200).json({
        success: true,
        message: 'Delivery settings updated successfully',
        data: settings,
    });
});

// GET /api/pharmacy/orders/:orderId/delivery-options
const getOrderDeliveryOptions = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const order = await Order.findOne({ _id: req.params.orderId, branch_id: branchId });
    if (!order) {
        throw new ApiError(404, 'Order not found in this pharmacy', 'ORDER_NOT_FOUND');
    }

    const branch = await Branch.findById(branchId);
    let pickupCoords = branch.location?.coordinates;
    if (!pickupCoords || (pickupCoords[0] === 0 && pickupCoords[1] === 0)) {
        pickupCoords = [branch.longitude || 0, branch.latitude || 0];
    }

    const candidates = await findEligiblePartners(branchId, pickupCoords, {
        deliveryMode: order.delivery_mode,
    });

    res.status(200).json({
        success: true,
        orderId: order._id,
        orderNumber: order.order_number,
        deliveryStatus: order.delivery_status,
        candidatesCount: candidates.length,
        candidates: candidates.map((c) => ({
            partnerId: c.partner._id,
            partnerName: c.partner.full_name,
            partnerType: c.partner.partner_type,
            mobile: c.partner.mobile,
            vehicleType: c.partner.vehicle_type,
            rating: c.partner.rating?.average || 5.0,
            distanceKm: c.distanceKm,
            activeCount: c.activeCount,
        })),
    });
});

// POST /api/pharmacy/orders/:orderId/assign-delivery
const assignDelivery = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const { partner_id } = req.body;

    if (!partner_id) {
        throw new ApiError(400, 'partner_id is required', 'PARTNER_ID_REQUIRED');
    }

    const order = await Order.findOne({ _id: req.params.orderId, branch_id: branchId });
    if (!order) {
        throw new ApiError(404, 'Order not found in this pharmacy', 'ORDER_NOT_FOUND');
    }

    const result = await manualAssign(order._id, partner_id, req.user?.id);

    res.status(200).json({
        success: true,
        message: 'Delivery assigned successfully',
        data: {
            deliveryId: result.delivery._id,
            partnerId: result.assignment.delivery_partner_id,
            pickupOtp: result.pickupOtp,
            deliveryStatus: result.delivery.delivery_status,
        },
    });
});

// POST /api/pharmacy/orders/:orderId/auto-assign
const autoAssign = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const order = await Order.findOne({ _id: req.params.orderId, branch_id: branchId });
    if (!order) {
        throw new ApiError(404, 'Order not found in this pharmacy', 'ORDER_NOT_FOUND');
    }

    const result = await autoAssignOrder(order._id, req.user?.id);

    res.status(200).json({
        success: result.success,
        message: result.message,
        data: result,
    });
});

// POST /api/pharmacy/orders/:orderId/reassign-delivery
const reassignDelivery = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const { new_partner_id } = req.body;

    const order = await Order.findOne({ _id: req.params.orderId, branch_id: branchId });
    if (!order) {
        throw new ApiError(404, 'Order not found in this pharmacy', 'ORDER_NOT_FOUND');
    }

    // Cancel previous active assignment if any
    await DeliveryAssignment.updateMany(
        { order_id: order._id, assignment_status: { $in: [ASSIGNMENT_STATUS.OFFERED, ASSIGNMENT_STATUS.ACCEPTED] } },
        { $set: { assignment_status: ASSIGNMENT_STATUS.CANCELLED } }
    );

    let result;
    if (new_partner_id) {
        result = await manualAssign(order._id, new_partner_id, req.user?.id);
    } else {
        result = await autoAssignOrder(order._id, req.user?.id);
    }

    emitDeliveryEvent(`pharmacy:${branchId}`, 'delivery_reassigned', {
        orderId: order._id.toString(),
        orderNumber: order.order_number,
        message: 'Order has been reassigned to a new partner.',
    });

    res.status(200).json({
        success: true,
        message: 'Delivery successfully reassigned',
        data: result,
    });
});

// POST /api/pharmacy/orders/:orderId/cancel-delivery
const cancelDelivery = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const { reason } = req.body;

    const order = await Order.findOne({ _id: req.params.orderId, branch_id: branchId });
    if (!order) {
        throw new ApiError(404, 'Order not found in this pharmacy', 'ORDER_NOT_FOUND');
    }

    await DeliveryAssignment.updateMany(
        { order_id: order._id, assignment_status: { $in: [ASSIGNMENT_STATUS.OFFERED, ASSIGNMENT_STATUS.ACCEPTED] } },
        { $set: { assignment_status: ASSIGNMENT_STATUS.CANCELLED } }
    );

    const delivery = await Delivery.findOne({ order_id: order._id });
    if (delivery) {
        delivery.delivery_status = DELIVERY_STATUS.CANCELLED;
        delivery.failure_reason = reason || 'Cancelled by pharmacy';
        await delivery.save();
    }

    order.delivery_status = DELIVERY_STATUS.CANCELLED;
    await order.save();

    emitDeliveryEvent(`pharmacy:${branchId}`, 'delivery_cancelled', {
        orderId: order._id.toString(),
        reason: reason || 'Cancelled by pharmacy',
    });

    res.status(200).json({
        success: true,
        message: 'Delivery cancelled successfully',
    });
});

// GET /api/pharmacy/deliveries
const getPharmacyDeliveries = asyncHandler(async (req, res) => {
    const branchId = getBranchId(req);
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const query = { pharmacy_id: branchId };
    if (status) query.delivery_status = status;

    const [deliveries, total] = await Promise.all([
        Delivery.find(query)
            .populate('delivery_partner_id', 'full_name mobile partner_type vehicle_type vehicle_number rating')
            .sort({ created_at: -1 })
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
    createDeliveryStaff,
    getDeliveryStaff,
    getDeliveryStaffById,
    updateDeliveryStaff,
    updateDeliveryStaffStatus,
    deleteDeliveryStaff,
    resendStaffInvitation,
    getSettings,
    updateSettings,
    getOrderDeliveryOptions,
    assignDelivery,
    autoAssign,
    reassignDelivery,
    cancelDelivery,
    getPharmacyDeliveries,
};
