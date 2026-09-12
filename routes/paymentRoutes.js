const express = require('express');
const router = express.Router();

const { createOrder, paymentWebhook } = require('../controllers/paymentController');
const { verifyPayment } = require('../controllers/razorpayController');
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');
const idempotent = require('../middleware/idempotency');

// POST /api/payments/create-order — authenticated patient creates a gateway order
router.post(
    '/create-order',
    protect,
    authorize(constants.ROLES.PATIENT),
    idempotent(),
    createOrder
);

// POST /api/payments/verify-payment — verify payment signature and update order status
router.post('/verify-payment', verifyPayment);

// POST /api/payments/webhook — public, called by Razorpay or mock test
router.post('/webhook', paymentWebhook);

module.exports = router;

