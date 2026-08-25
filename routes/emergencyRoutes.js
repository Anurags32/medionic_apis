const express = require('express');
const router = express.Router();

const { sendSOS, getNearestAmbulances } = require('../controllers/emergencyController');
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

router.use(protect);

router.post('/sos', authorize(constants.ROLES.PATIENT), sendSOS);

router.get('/ambulances/nearest', getNearestAmbulances);

module.exports = router;
