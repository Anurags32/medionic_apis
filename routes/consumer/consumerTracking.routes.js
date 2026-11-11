const express = require('express');
const router = express.Router();
const consumerTrackingController = require('../../controllers/delivery/consumerTracking.controller');
const { protect, optionalAuth } = require('../../middleware/auth');

// Consumer tracking routes (optionalAuth allows testing / direct tracking links if authenticated)
router.use(optionalAuth);

router.get('/orders/:orderId/delivery', consumerTrackingController.getOrderDelivery);
router.get('/orders/:orderId/tracking', consumerTrackingController.getOrderTracking);
router.get('/orders/:orderId/delivery-status', consumerTrackingController.getOrderDeliveryStatus);
router.get('/orders/:orderId/delivery-partner', consumerTrackingController.getOrderDeliveryPartner);

module.exports = router;

