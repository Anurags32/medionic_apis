const jwt = require('jsonwebtoken');
const { DeliveryPartner } = require('../../models/delivery');
const constants = require('../../config/constants');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { PARTNER_ACCOUNT_STATUS } = require('../../config/deliveryConstants');

const authenticatePartner = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        throw new ApiError(401, 'Authentication token missing', 'TOKEN_MISSING');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || constants.JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new ApiError(401, 'Token expired. Please login again.', 'TOKEN_EXPIRED');
        }
        throw new ApiError(401, 'Invalid token', 'TOKEN_INVALID');
    }

    const partner = await DeliveryPartner.findById(decoded.id || decoded.partnerId || decoded.userId);
    if (!partner) {
        throw new ApiError(401, 'Delivery partner account not found', 'PARTNER_NOT_FOUND');
    }

    if (partner.account_status === PARTNER_ACCOUNT_STATUS.BLOCKED) {
        throw new ApiError(403, 'Your account has been blocked. Please contact support.', 'ACCOUNT_BLOCKED');
    }

    if (partner.account_status === PARTNER_ACCOUNT_STATUS.SUSPENDED) {
        throw new ApiError(403, 'Your account has been temporarily suspended.', 'ACCOUNT_SUSPENDED');
    }

    req.deliveryPartner = partner;
    req.user = {
        _id: partner._id,
        id: partner._id,
        role: partner.partner_type,
        email: partner.email,
        pharmacy_id: partner.pharmacy_id,
    };

    next();
});

const requirePartnerRole = (allowedTypes) => {
    return (req, res, next) => {
        if (!req.deliveryPartner) {
            return next(new ApiError(401, 'Unauthorized', 'UNAUTHORIZED'));
        }
        const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
        if (!types.includes(req.deliveryPartner.partner_type)) {
            return next(
                new ApiError(
                    403,
                    `Access restricted to ${types.join(', ')} partners only.`,
                    'ROLE_RESTRICTED'
                )
            );
        }
        next();
    };
};

module.exports = {
    authenticatePartner,
    requirePartnerRole,
};

