const express = require('express');
const router = express.Router();

// Import controller functions
const {
    register,
    login,
    completePatientProfile,
    completeDoctorProfile,
    completeMRProfile,
    refreshToken,
    logout,
    forgotPassword,
    resetPassword,
    getMe,
    updateMe
} = require('../controllers/authController');

// Import middleware
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

const { adminLogin, verifyDoctor, verifyMR } = require('../controllers/adminController');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Verification routes matching exact requirements
router.put('/doctor/:id/verify-status', protect, authorize(constants.ROLES.ADMIN), verifyDoctor);
router.put('/mr/:id/verify-status', protect, authorize(constants.ROLES.ADMIN), verifyMR);

// Protected routes
router.use(protect); // All routes below this are protected

// Profile completion routes
router.post('/complete-profile/patient',
    authorize(constants.ROLES.PATIENT),
    completePatientProfile
);

router.post('/complete-profile/doctor',
    authorize(constants.ROLES.DOCTOR),
    completeDoctorProfile
);

router.post('/complete-profile/mr',
    authorize(constants.ROLES.MR),
    completeMRProfile
);

// User profile routes
router.route('/me')
    .get(getMe)
    .put(updateMe);

// Logout
router.post('/logout', logout);

module.exports = router;