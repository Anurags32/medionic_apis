const { Branch } = require('../../models/pharmacy');
const { verifyAccessToken } = require('../../config/pharmacyJwt');
const ApiError = require('../../utils/ApiError');

/**
 * planGuard middleware enforces pharmacy plan status and read-only mode.
 * 
 * Rules:
 * - Applied to routes except: /auth/*, plan/recharge/payment routes, GET /settings, GET dashboard, GET /branch/*
 * - Reads of existing data (GET, HEAD, OPTIONS) stay allowed (read-only mode).
 * - If plan status is EXPIRED (after optional PLAN_GRACE_DAYS): block write operations
 *   (POST, PUT, PATCH, DELETE on inventory, orders, staff, stores/branch, returns, etc.)
 *   with HTTP 403 (or 402) and body:
 *   { success: false, code: "PLAN_EXPIRED", message: "Your plan has expired. Renew to continue." }
 */
const planGuard = async (req, res, next) => {
    // 1. Allow all safe read-only methods (reads of existing data stay allowed in read-only mode)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const originalUrl = req.originalUrl || req.url || '';

    // 2. Route exemptions:
    // - /auth/*
    // - plan / subscription / recharge / payment routes
    if (
        originalUrl.includes('/auth') ||
        originalUrl.includes('/subscription') ||
        originalUrl.includes('/plan') ||
        originalUrl.includes('/recharge') ||
        originalUrl.includes('/payment')
    ) {
        return next();
    }

    // 3. For write operations (POST, PUT, PATCH, DELETE)
    try {
        let branchId = req.user?.branchId || req.headers['x-branch-id'];
        if (!branchId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = verifyAccessToken(token);
                if (decoded && decoded.branchId) {
                    branchId = decoded.branchId;
                }
            } catch (_) {}
        }

        if (!branchId) {
            return next();
        }

        const branch = await Branch.findById(branchId);
        if (!branch) {
            return next();
        }

        const sub = branch.getSubscriptionDetails();
        req.branchSubscription = sub;

        // If plan is EXPIRED (past expiry & grace period), block mutations
        if (sub.isReadOnly || sub.status === 'EXPIRED') {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                code: 'PLAN_EXPIRED',
                error_code: 'SUBSCRIPTION_EXPIRED', // for backward compatibility
                message: 'Your plan has expired. Renew to continue.',
                error: {
                    code: 'PLAN_EXPIRED',
                    details: [{ field: 'subscription', message: 'Plan expired on ' + sub.expiryDate }],
                },
                subscription: sub,
            });
        }

        next();
    } catch (err) {
        next(err);
    }
};

const requireActiveSubscription = planGuard;

module.exports = {
    planGuard,
    requireActiveSubscription,
};
