const express = require('express');
const router = express.Router();

const authRoutes = require('./partnerAuth.routes');
const profileController = require('../../controllers/delivery/partnerProfile.controller');
const locationController = require('../../controllers/delivery/partnerLocation.controller');
const requestController = require('../../controllers/delivery/deliveryRequest.controller');
const lifecycleController = require('../../controllers/delivery/deliveryLifecycle.controller');
const { authenticatePartner } = require('../../middleware/delivery/partnerAuth.middleware');

// Group A: Authentication
router.use('/auth', authRoutes);

// All routes below require Delivery Partner authentication
router.use(authenticatePartner);

// Group B: Profile & KYC
router.get('/profile', profileController.getProfile);
router.put('/profile', profileController.updateProfile);
router.post('/kyc/upload', profileController.uploadKyc);
router.get('/kyc/status', profileController.getKycStatus);
router.put('/vehicle', profileController.updateVehicle);
router.get('/account/status', profileController.getAccountStatus);

// Group C: Availability & Location
router.put('/availability', locationController.updateAvailability);
router.post('/location/update', locationController.updateLocation);
router.get('/location/current', locationController.getCurrentLocation);
router.get('/earnings/summary', locationController.getEarningsSummary);

// Group D: Requests
router.get('/requests', requestController.getRequests);
router.get('/requests/:requestId', requestController.getRequestById);
router.post('/requests/:requestId/accept', requestController.acceptRequest);
router.post('/requests/:requestId/reject', requestController.rejectRequest);
router.get('/active', requestController.getActiveDelivery);
router.get('/history', requestController.getDeliveryHistory);

// Group E: Lifecycle
router.post('/:deliveryId/reached-pharmacy', lifecycleController.reachedPharmacy);
router.post('/:deliveryId/verify-pickup-otp', lifecycleController.verifyPickupOtp);
router.post('/:deliveryId/pickup-confirm', lifecycleController.pickupConfirm);
router.post('/:deliveryId/start-delivery', lifecycleController.startDelivery);
router.post('/:deliveryId/reached-customer', lifecycleController.reachedCustomer);
router.post('/:deliveryId/verify-delivery-otp', lifecycleController.verifyDeliveryOtp);
router.post('/:deliveryId/complete', lifecycleController.completeDelivery);
router.post('/:deliveryId/fail', lifecycleController.failDelivery);
router.post('/:deliveryId/return', lifecycleController.returnDelivery);
router.get('/:deliveryId/tracking', lifecycleController.getTracking);

module.exports = router;

