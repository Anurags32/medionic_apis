const express = require('express');
const router = express.Router();

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


const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

const { adminLogin, verifyDoctor, verifyMR } = require('../controllers/adminController');

router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.put('/doctor/:id/verify-status', protect, authorize(constants.ROLES.ADMIN), verifyDoctor);
router.put('/mr/:id/verify-status', protect, authorize(constants.ROLES.ADMIN), verifyMR);


router.use(protect);


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


router.route('/me')
    .get(getMe)
    .put(updateMe);

router.post('/logout', logout);

module.exports = router;