const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const PharmacyOrder = require('../models/PharmacyOrder');
const Appointment = require('../models/Appointment');
const constants = require('../config/constants');

/**
 * @desc    Create a new Razorpay order
 * @route   POST /api/create-order
 * @access  Public
 */
exports.createOrder = async (req, res, next) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;

        // Validate amount >= 100 paise (1 INR)
        const numericAmount = Number(amount);
        if (amount === undefined || amount === null || isNaN(numericAmount) || numericAmount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Amount is required and must be at least 100 paise (₹1.00).'
            });
        }

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            return res.status(500).json({
                success: false,
                message: 'Razorpay credentials are not configured on the server'
            });
        }

        const instance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });

        const options = {
            amount: Math.round(numericAmount),
            currency: currency || 'INR',
            receipt: receipt || `rcpt_${Date.now()}`
        };

        const order = await instance.orders.create(options);

        return res.status(200).json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        console.error('Razorpay order creation error:', error);

        const statusCode = error.statusCode || error.status;
        const errorDescription = error.error?.description || error.message || 'Razorpay order creation failed';

        // Check for authentication failure
        if (
            statusCode === 401 ||
            (error.error && error.error.code === 'BAD_REQUEST_ERROR' && /auth|key/i.test(errorDescription))
        ) {
            return res.status(401).json({
                success: false,
                message: errorDescription || 'Razorpay authentication failed'
            });
        }

        return res.status(500).json({
            success: false,
            message: errorDescription
        });
    }
};

/**
 * @desc    Verify Razorpay payment signature
 * @route   POST /api/verify-payment
 * @access  Public
 */
exports.verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // If any field missing -> 400
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment verification fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are all required.'
            });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
            return res.status(500).json({
                success: false,
                message: 'Razorpay key secret is not configured on the server'
            });
        }

        // Generate signature: HMAC SHA256 of order_id + "|" + payment_id
        const generated = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        // If generated !== razorpay_signature -> 400, do NOT mark payment as successful
        if (generated !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed: Invalid signature'
            });
        }

        // Signature verified successfully -> update DB order status if order reference exists
        let updatedOrder = null;
        try {
            const { referenceId, orderId, appointmentId, pharmacyOrderId, receipt } = req.body;
            const targetId = referenceId || orderId || appointmentId || pharmacyOrderId;

            if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
                const pharmacyOrder = await PharmacyOrder.findById(targetId);
                if (pharmacyOrder) {
                    pharmacyOrder.paymentStatus = 'completed';
                    pharmacyOrder.transactionId = razorpay_payment_id;
                    if (constants.ORDER_STATUS?.CONFIRMED) {
                        pharmacyOrder.status = constants.ORDER_STATUS.CONFIRMED;
                    }
                    await pharmacyOrder.save();
                    updatedOrder = { type: 'PharmacyOrder', id: pharmacyOrder._id };
                } else {
                    const appointment = await Appointment.findById(targetId);
                    if (appointment) {
                        appointment.paymentStatus = 'completed';
                        appointment.transactionId = razorpay_payment_id;
                        if (constants.APPOINTMENT_STATUS?.CONFIRMED) {
                            appointment.status = constants.APPOINTMENT_STATUS.CONFIRMED;
                        }
                        await appointment.save();
                        updatedOrder = { type: 'Appointment', id: appointment._id };
                    }
                }
            } else if (receipt) {
                const pharmacyOrder = await PharmacyOrder.findOne({ orderNumber: receipt });
                if (pharmacyOrder) {
                    pharmacyOrder.paymentStatus = 'completed';
                    pharmacyOrder.transactionId = razorpay_payment_id;
                    if (constants.ORDER_STATUS?.CONFIRMED) {
                        pharmacyOrder.status = constants.ORDER_STATUS.CONFIRMED;
                    }
                    await pharmacyOrder.save();
                    updatedOrder = { type: 'PharmacyOrder', id: pharmacyOrder._id };
                }
            }
        } catch (dbError) {
            console.warn('DB update during payment verification skipped or encountered an issue:', dbError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            ...(updatedOrder ? { order: updatedOrder } : {})
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error during payment verification'
        });
    }
};
