const { verifyAccessToken } = require('../../config/pharmacyJwt');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { User } = require('../../models/pharmacy');


const authenticateToken = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new ApiError(401, 'Access token is missing or malformed', 'TOKEN_MISSING');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
        decoded = verifyAccessToken(token);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new ApiError(401, 'Access token has expired. Please refresh your session.', 'TOKEN_EXPIRED');
        }
        throw new ApiError(401, 'Invalid or corrupted access token', 'TOKEN_INVALID');
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
        throw new ApiError(401, 'User account does not exist or has been removed', 'USER_NOT_FOUND');
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.token_version) {
        throw new ApiError(401, 'Session has been invalidated. Please log in again.', 'SESSION_INVALIDATED');
    }

    if (user.is_blocked) {
        throw new ApiError(
            403,
            user.block_reason
                ? `Your account has been blocked: ${user.block_reason}`
                : 'Your account has been blocked by the pharmacy owner. Contact administrator.',
            'ACCOUNT_BLOCKED'
        );
    }

    if (!user.is_active) {
        throw new ApiError(403, 'Your account is deactivated. Contact administrator.', 'ACCOUNT_INACTIVE');
    }

    req.user = {
        id: user._id.toString(),
        userId: user._id.toString(),
        branchId: decoded.branchId || (user.branch_id ? user.branch_id.toString() : null),
        role: user.role,
        features: Array.isArray(user.features_granted) ? user.features_granted : [],
        email: user.email,
        fullName: user.full_name,
        tokenVersion: user.token_version,
    };

    next();
});

module.exports = authenticateToken;