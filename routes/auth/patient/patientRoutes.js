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

const upload = require('../../../services/uploadService');
const { validate } = require('../../../middleware/validation');

const uploadFields = upload.fields([
    { name: 'profilePhoto', maxCount: 1 }
]);

// Routes
router.post('/register', uploadFields, validate('patientRegister'), patientRegister);
router.post('/login', patientLogin);

module.exports = router;
