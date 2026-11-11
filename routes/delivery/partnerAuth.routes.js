const express = require('express');
const router = express.Router();
const partnerAuthController = require('../../controllers/delivery/partnerAuth.controller');
const { authenticatePartner } = require('../../middleware/delivery/partnerAuth.middleware');

router.post('/register', partnerAuthController.register);
router.post('/login', partnerAuthController.login);
router.post('/send-otp', partnerAuthController.sendOtp);
router.post('/verify-otp', partnerAuthController.verifyOtp);
router.post('/forgot-password', partnerAuthController.forgotPassword);
router.post('/reset-password', partnerAuthController.resetPassword);
router.post('/refresh-token', partnerAuthController.refreshToken);
router.post('/logout', authenticatePartner, partnerAuthController.logout);
router.get('/me', authenticatePartner, partnerAuthController.getMe);

module.exports = router;

