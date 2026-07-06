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

// Config multer storage disk engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Resolve upload folder in backend root
        const uploadDir = path.join(__dirname, '../../../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure file filters and size limits
const upload = multer({
    storage: storage,
    limits: { fileSize: constants.FILE_UPLOAD.MAX_SIZE || 5 * 1024 * 1024 }, // 5MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = constants.FILE_UPLOAD.ALLOWED_TYPES || ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'), false);
        }
    }
});

// Multipurpose multipart fields handler
const uploadFields = upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'govId', maxCount: 1 },
    { name: 'degree', maxCount: 1 },
    { name: 'councilId', maxCount: 1 }
]);

// ─── Routes ──────────────────────────────────────────────────────────────────

// Public signup & login
router.post('/register', uploadFields, doctorRegister);
router.post('/login', doctorLogin);

// Protected Doctor Profile and verification status check
router.route('/profile')
    .get(protect, authorize(constants.ROLES.DOCTOR), getDoctorProfile)
    .put(protect, authorize(constants.ROLES.DOCTOR), upload.fields([{ name: 'profilePhoto', maxCount: 1 }]), updateDoctorProfile);

router.get('/status', protect, authorize(constants.ROLES.DOCTOR), getVerificationStatus);

// Basic Admin-side status update API (requires admin role or simple protect for testing)
router.put('/status', protect, authorize(constants.ROLES.ADMIN, constants.ROLES.DOCTOR), updateVerificationStatusAdmin);

module.exports = router;
