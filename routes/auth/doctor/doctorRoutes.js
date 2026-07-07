const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import controller functions
const {
    doctorRegister,
    doctorLogin,
    getDoctorProfile,
    updateDoctorProfile,
    getVerificationStatus,
    updateVerificationStatusAdmin
} = require('../../../controllers/auth/doctor/doctorController');

// Import middleware
const { protect, authorize } = require('../../../middleware/auth');
const constants = require('../../../config/constants');

const upload = require('../../../services/uploadService');
const { validate } = require('../../../middleware/validation');

// Multipurpose multipart fields handler
const uploadFields = upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'govId', maxCount: 1 },
    { name: 'degree', maxCount: 1 },
    { name: 'councilId', maxCount: 1 }
]);

// ─── Routes ──────────────────────────────────────────────────────────────────

// Public signup & login
router.post('/register', uploadFields, validate('doctorRegister'), doctorRegister);
router.post('/login', doctorLogin);

// Protected Doctor Profile and verification status check
router.route('/profile')
    .get(protect, authorize(constants.ROLES.DOCTOR), getDoctorProfile)
    .put(protect, authorize(constants.ROLES.DOCTOR), upload.fields([{ name: 'profilePhoto', maxCount: 1 }]), updateDoctorProfile);

router.get('/status', protect, authorize(constants.ROLES.DOCTOR), getVerificationStatus);

// Basic Admin-side status update API (requires admin role or simple protect for testing)
router.put('/status', protect, authorize(constants.ROLES.ADMIN, constants.ROLES.DOCTOR), updateVerificationStatusAdmin);

module.exports = router;
