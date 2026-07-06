const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
    patientRegister,
    patientLogin
} = require('../../../controllers/auth/patient/patientController');
const constants = require('../../../config/constants');

// Config multer storage disk engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
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

const uploadFields = upload.fields([
    { name: 'profilePhoto', maxCount: 1 }
]);

// Routes
router.post('/register', uploadFields, patientRegister);
router.post('/login', patientLogin);

module.exports = router;
