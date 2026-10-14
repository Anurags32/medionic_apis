const express = require('express');
const router = express.Router();
const returnController = require('../../controllers/pharmacy/return.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const { requireActiveSubscription } = require('../../middleware/pharmacy/subscription.middleware');
const { FEATURES } = require('../../config/pharmacyConstants');

// Require authentication for all return routes
router.use(authenticateToken);

// List returns with pagination and search
router.get(
    '/',
    authorizeFeature(FEATURES.INVENTORY_VIEW),
    returnController.getReturns
);

// Get single return detail
router.get(
    '/:id',
    authorizeFeature(FEATURES.INVENTORY_VIEW),
    returnController.getReturnById
);

// Create new return
router.post(
    '/',
    requireActiveSubscription,
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    returnController.createReturn
);

// Inspect a return
router.post(
    '/:id/inspect',
    requireActiveSubscription,
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    returnController.inspectReturn
);

// Restock returned items
router.post(
    '/:id/restock',
    requireActiveSubscription,
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    returnController.restockReturn
);

// Dispose returned items
router.post(
    '/:id/dispose',
    requireActiveSubscription,
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    returnController.disposeReturn
);

module.exports = router;
