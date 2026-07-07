const express = require('express');
const router = express.Router();

const { getLabTests, getLabTest, bookLabTest, getMyLabBookings } = require('../controllers/labController');
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

// All lab routes require authentication
router.use(protect);

// Lab tests catalog (any authenticated user can browse)
router.get('/tests', getLabTests);
router.get('/tests/:id', getLabTest);

// Lab bookings (patient only)
router.route('/bookings')
    .get(authorize(constants.ROLES.PATIENT), getMyLabBookings)
    .post(authorize(constants.ROLES.PATIENT), bookLabTest);

module.exports = router;
