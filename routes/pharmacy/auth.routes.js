const express = require('express');
const router = express.Router();
const authController = require('../../controllers/pharmacy/auth.controller');
const validate = require('../../middleware/pharmacy/validate.middleware');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authLimiter, otpLimiter } = require('../../middleware/pharmacy/rate-limit.middleware');
const {
    registerOwnerRules,
    loginRules,
    refreshTokenRules,
    changePasswordRules,
    sendOtpRules,
    verifyOtpRules,
} = require('../../validations/pharmacy/auth.validation');


router.post('/register', validate(registerOwnerRules), authController.registerOwner);
router.post('/login', authLimiter, validate(loginRules), authController.login);
router.post('/refresh-token', validate(refreshTokenRules), authController.refreshToken);
router.post('/send-otp', otpLimiter, validate(sendOtpRules), authController.sendOtp);
router.post('/verify-otp', authLimiter, validate(verifyOtpRules), authController.verifyOtp);

router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);
router.post('/change-password', authenticateToken, validate(changePasswordRules), authController.changePassword);

module.exports = router;