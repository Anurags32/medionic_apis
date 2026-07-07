const express = require('express');
const router = express.Router();

const { sendSOS, getNearestAmbulances } = require('../controllers/emergencyController');
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

// All emergency routes require authentication
router.use(protect);

// POST /api/emergency/sos — { latitude, longitude, message? }
router.post('/sos', authorize(constants.ROLES.PATIENT), sendSOS);

// GET /api/emergency/ambulances/nearest?lat&lng
router.get('/ambulances/nearest', getNearestAmbulances);

module.exports = router;
