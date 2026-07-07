const express = require('express');
const router = express.Router();

const { createOrder, paymentWebhook } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

// POST /api/payments/create-order — authenticated patient creates a gateway order
router.post(
    '/create-order',
    protect,
    authorize(constants.ROLES.PATIENT),
    createOrder
);

// POST /api/payments/webhook — public, called by Razorpay or mock test
router.post('/webhook', paymentWebhook);

module.exports = router;
