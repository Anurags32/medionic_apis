const express = require('express');
const router = express.Router();
const pharmacyDeliveryController = require('../../controllers/delivery/pharmacyDelivery.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { protect } = require('../../middleware/auth');

// Allow either pharmacy token or main user auth
const flexibleAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Try pharmacy authenticateToken first
        authenticateToken(req, res, (err) => {
            if (!err && req.user) return next();
            // If failed, try main protect middleware
            protect(req, res, next);
        });
    } else {
        protect(req, res, next);
    }
};

router.use(flexibleAuth);

// Group F: Staff Management
router.post('/delivery-staff', pharmacyDeliveryController.createDeliveryStaff);
router.get('/delivery-staff', pharmacyDeliveryController.getDeliveryStaff);
router.get('/delivery-staff/:staffId', pharmacyDeliveryController.getDeliveryStaffById);
router.put('/delivery-staff/:staffId', pharmacyDeliveryController.updateDeliveryStaff);
router.put('/delivery-staff/:staffId/status', pharmacyDeliveryController.updateDeliveryStaffStatus);
router.delete('/delivery-staff/:staffId', pharmacyDeliveryController.deleteDeliveryStaff);
router.post('/delivery-staff/:staffId/resend-invitation', pharmacyDeliveryController.resendStaffInvitation);

// Group G: Delivery Settings & Assignment
router.get('/delivery/settings', pharmacyDeliveryController.getSettings);
router.put('/delivery/settings', pharmacyDeliveryController.updateSettings);
router.get('/orders/:orderId/delivery-options', pharmacyDeliveryController.getOrderDeliveryOptions);
router.post('/orders/:orderId/assign-delivery', pharmacyDeliveryController.assignDelivery);
router.post('/orders/:orderId/auto-assign', pharmacyDeliveryController.autoAssign);
router.post('/orders/:orderId/reassign-delivery', pharmacyDeliveryController.reassignDelivery);
router.post('/orders/:orderId/cancel-delivery', pharmacyDeliveryController.cancelDelivery);
router.get('/deliveries', pharmacyDeliveryController.getPharmacyDeliveries);

module.exports = router;

