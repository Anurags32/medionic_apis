const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/pharmacy/order.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const validate = require('../../middleware/pharmacy/validate.middleware');
const { FEATURES } = require('../../config/pharmacyConstants');
const {
    createOrderRules,
    updateOrderStatusRules,
    assignPackerRules,
} = require('../../validations/pharmacy/order.validation');

router.use(authenticateToken);

router.post(
    '/',
    authorizeFeature(FEATURES.ORDERS_PROCESS),
    validate(createOrderRules),
    orderController.createOrder
);

router.get(
    '/',
    authorizeFeature(FEATURES.ORDERS_VIEW),
    orderController.getOrders
);

router.get(
    '/:id',
    authorizeFeature(FEATURES.ORDERS_VIEW),
    orderController.getOrderById
);

router.post(
    '/:id/accept',
    authorizeFeature(FEATURES.ORDERS_PROCESS),
    orderController.acceptOrder
);

router.patch(
    '/:id/status',
    authorizeFeature(FEATURES.ORDERS_PROCESS),
    validate(updateOrderStatusRules),
    orderController.updateOrderStatus
);

router.patch(
    '/:id/assign-packer',
    authorizeFeature(FEATURES.ORDERS_PROCESS),
    validate(assignPackerRules),
    orderController.assignPacker
);

module.exports = router;
