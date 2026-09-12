const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../config/pharmacyConstants');


const authorizeFeature = (requiredFeature) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
        }

        if (req.user.role === ROLES.PHARMACY_OWNER) {
            return next();
        }

        if (!req.user.features || !req.user.features.includes(requiredFeature)) {
            throw new ApiError(
                403,
                `Permission denied: You do not have permission to access '${requiredFeature}'`,
                'PERMISSION_DENIED'
            );
        }

        next();
    };
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
        }

        if (req.user.role === ROLES.PHARMACY_OWNER || allowedRoles.includes(req.user.role)) {
            return next();
        }

        throw new ApiError(
            403,
            `Access restricted: Action requires one of [${allowedRoles.join(', ')}]`,
            'ROLE_NOT_ALLOWED'
        );
    };
};

const authorizeOwnerOnly = (req, res, next) => {
    if (!req.user) {
        throw new ApiError(401, 'Authentication required', 'AUTH_REQUIRED');
    }

    if (req.user.role !== ROLES.PHARMACY_OWNER) {
        throw new ApiError(
            403,
            'Permission denied: Only a Pharmacy Owner can perform this action',
            'OWNER_ONLY_RESTRICTED'
        );
    }

    next();
};

module.exports = {
    authorizeFeature,
    authorizeRoles,
    authorizeOwnerOnly,
};