const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
    mrRegister,
    mrLogin
} = require('../../../controllers/auth/mr/mrController');
const constants = require('../../../config/constants');

const upload = require('../../../services/uploadService');
const { validate } = require('../../../middleware/validation');

// Multipart-form uploads configuration for MR files
const uploadFields = upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'companyId', maxCount: 1 },
    { name: 'govId', maxCount: 1 },
    { name: 'authLetter', maxCount: 1 }
]);

// Routes
router.post('/register', uploadFields, validate('mrRegister'), mrRegister);
router.post('/login', mrLogin);

module.exports = router;
