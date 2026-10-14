const { Branch } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');

/**
 * Middleware to ensure the active branch has a valid, non-expired subscription.
 * Blocks write actions like creating medicines, batches, orders, or bills if subscription is expired.
 */
const requireActiveSubscription = async (req, res, next) => {
    try {
        const branchId = req.user?.branchId;
        if (!branchId) {
            return next();
        }

        const branch = await Branch.findById(branchId);
        if (!branch) {
            return next(new ApiError(404, 'Branch not found', 'BRANCH_NOT_FOUND'));
        }

        const sub = branch.getSubscriptionDetails();
        if (sub.isExpired) {
            return res.status(403).json({
                success: false,
                statusCode: 403,
                message: 'Your pharmacy subscription has expired. Please renew your plan to perform this action.',
                code: 'SUBSCRIPTION_EXPIRED',
                error: {
                    code: 'SUBSCRIPTION_EXPIRED',
                    details: [{ field: 'subscription', message: 'Plan expired on ' + sub.expiryDate }],
                },
                subscription: sub,
            });
        }

        req.branchSubscription = sub;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    requireActiveSubscription,
};
