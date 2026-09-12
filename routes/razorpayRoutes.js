const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment } = require('../controllers/razorpayController');

// POST /api/create-order — Create a Razorpay order
router.post('/create-order', createOrder);

// POST /api/verify-payment — Verify payment signature and update order status
router.post('/verify-payment', verifyPayment);

module.exports = router;
