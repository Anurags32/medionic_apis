const express = require('express');
const router = express.Router();
const adminDeliveryController = require('../../controllers/delivery/adminDelivery.controller');
const { protect, authorize } = require('../../middleware/auth');
const constants = require('../../config/constants');

// Protect all admin delivery routes with Admin authorization
router.use(protect, authorize(constants.ROLES.ADMIN));

router.get('/partners', adminDeliveryController.getAllPartners);
router.get('/partners/:partnerId', adminDeliveryController.getPartnerById);
router.put('/partners/:partnerId/verify', adminDeliveryController.verifyPartner);
router.put('/partners/:partnerId/status', adminDeliveryController.updatePartnerStatus);
router.post('/partners/:partnerId/suspend', adminDeliveryController.suspendPartner);
router.get('/assignments', adminDeliveryController.getAllAssignments);
router.get('/analytics', adminDeliveryController.getDeliveryAnalytics);

module.exports = router;

