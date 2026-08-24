const Razorpay = require('razorpay');
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const PharmacyOrder = require('../models/PharmacyOrder');
const Patient = require('../models/Patient');
const ErrorResponse = require('../utils/errorResponse');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');
const { ensureConsultationRoom } = require('../services/consultationRoomService');

// ─── Razorpay client (lazy-init so missing keys don't crash startup) ──────────
let razorpayClient = null;
const getRazorpay = () => {
    if (!razorpayClient) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret || keyId.startsWith('rzp_test_your')) {
            return null; // Fall through to mock mode
        }
        razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
    return razorpayClient;
};

// @desc    Create Razorpay order (or mock order in dev when keys absent)
// @route   POST /api/payments/create-order
// @access  Private (Patient)
exports.createOrder = async (req, res, next) => {
    try {
        const { purpose, referenceId } = req.body;
        // purpose: 'appointment' | 'pharmacy'
        // referenceId: appointmentId or pharmacyOrderId

        const validPurposes = ['appointment', 'pharmacy'];
        if (!purpose || !validPurposes.includes(purpose)) {
            return next(new ErrorResponse(`purpose must be one of: ${validPurposes.join(', ')}`, 400));
        }

        if (!referenceId) {
            return next(new ErrorResponse('referenceId is required', 400));
        }

        let authoritativeAmount;
        if (purpose === 'appointment') {
            const patient = await Patient.findOne({ userId: req.user._id });
            const appointment = await Appointment.findOne({ _id: referenceId, patientId: patient?._id });
            if (!appointment) return next(new ErrorResponse('Appointment not found', 404));
            authoritativeAmount = appointment.amount;
        } else {
            const order = await PharmacyOrder.findOne({ _id: referenceId, patientId: req.user._id });
            if (!order) return next(new ErrorResponse('Pharmacy order not found', 404));
            authoritativeAmount = order.finalAmount;
        }

        if (!Number.isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
            return next(new ErrorResponse('Reference has no payable amount', 400));
        }

        const amountInPaise = Math.round(authoritativeAmount * 100); // Razorpay uses smallest currency unit

        const rzp = getRazorpay();

        // ── Mock mode (no real Razorpay keys) ─────────────────────────────────
        if (!rzp && process.env.NODE_ENV === 'production') {
            return next(new ErrorResponse('Payment gateway is not configured', 503));
        }

        if (!rzp) {
            const mockOrderId = 'order_mock_' + helpers.generateRandomString(14);
            return res.status(200).json({
                success: true,
                message: 'Mock payment order created (Razorpay keys not configured)',
                data: {
                    orderId: mockOrderId,
                    amount: amountInPaise,
                    amountDisplay: authoritativeAmount,
                    currency: 'INR',
                    purpose,
                    referenceId: referenceId || null,
                    keyId: 'MOCK_KEY',
                    mode: 'mock'
                }
            });
        }

        // ── Real Razorpay order ────────────────────────────────────────────────
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_${purpose}_${Date.now()}`,
            notes: {
                purpose,
                referenceId: referenceId || '',
                userId: req.user._id.toString()
            }
        };

        const razorpayOrder = await rzp.orders.create(options);

        res.status(200).json({
            success: true,
            message: 'Razorpay order created successfully',
            data: {
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                amountDisplay: authoritativeAmount,
                currency: razorpayOrder.currency,
                purpose,
                referenceId: referenceId || null,
                keyId: process.env.RAZORPAY_KEY_ID,
                mode: 'live'
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Razorpay / mock webhook — updates paymentStatus on Appointment or PharmacyOrder
// @route   POST /api/payments/webhook
// @access  Public
exports.paymentWebhook = async (req, res, next) => {
    try {
        const rawBody = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(JSON.stringify(req.body || {}));
        const payload = JSON.parse(rawBody.toString('utf8'));
        const signature = req.headers['x-razorpay-signature'];
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        // ── Verify Razorpay signature when keys are configured ─────────────────
        if (signature && keySecret && !keySecret.startsWith('your_razorpay')) {
            const expectedSig = crypto
                .createHmac('sha256', keySecret)
                .update(rawBody)
                .digest('hex');

            const receivedSignature = Buffer.from(String(signature));
            const expectedSignature = Buffer.from(expectedSig);
            if (receivedSignature.length !== expectedSignature.length ||
                !crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
                return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
            }
        }

        if (process.env.NODE_ENV === 'production' && (!signature || !keySecret)) {
            return res.status(400).json({ success: false, message: 'Webhook signature is required' });
        }

        // ── Parse payload (supports Razorpay standard format and mock format) ──
        let referenceId = null;
        let purpose = null;
        let payStatus = 'failed';
        let txId = null;

        if (payload.payload && payload.payload.payment && payload.payload.payment.entity) {
            // Razorpay webhook format
            const entity = payload.payload.payment.entity;
            referenceId = entity.notes ? entity.notes.referenceId || entity.notes.appointmentId : null;
            purpose = entity.notes ? entity.notes.purpose || 'appointment' : 'appointment';
            payStatus = ['captured', 'authorized'].includes(entity.status) ? 'completed' : 'failed';
            txId = entity.id;
        } else {
            // Simple mock / manual format
            referenceId = payload.referenceId || payload.appointmentId;
            purpose = payload.purpose || 'appointment';
            payStatus = payload.status === 'success' ? 'completed' : 'failed';
            txId = payload.transactionId || 'tx_' + helpers.generateRandomString(12);
        }

        if (!referenceId) {
            return res.status(400).json({ success: false, message: 'Reference ID not found in payload' });
        }

        // ── Update the correct document ────────────────────────────────────────
        if (purpose === 'pharmacy') {
            const order = await PharmacyOrder.findById(referenceId);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Pharmacy order not found' });
            }

            order.paymentStatus = payStatus;
            order.transactionId = txId;
            if (payStatus === 'completed') {
                order.status = constants.ORDER_STATUS.CONFIRMED;
                order.addTrackingUpdate('confirmed', '', 'Payment confirmed — order is being processed');
            } else {
                order.status = constants.ORDER_STATUS.CANCELLED;
                order.cancelOrder('system', 'Payment failed');
            }
            await order.save();

            return res.status(200).json({
                success: true,
                message: 'Webhook processed — pharmacy order updated',
                data: { orderId: order._id, paymentStatus: order.paymentStatus, status: order.status }
            });
        }

        // Default: appointment
        const appointment = await Appointment.findById(referenceId);
        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        appointment.paymentStatus = payStatus;
        appointment.transactionId = txId;

        if (payStatus === 'completed') {
            appointment.status = constants.APPOINTMENT_STATUS.CONFIRMED;
            await ensureConsultationRoom(appointment);
        } else {
            appointment.status = constants.APPOINTMENT_STATUS.CANCELLED;
            appointment.cancelledBy = 'system';
            appointment.cancellationReason = 'Payment failed';
        }

        await appointment.save();

        res.status(200).json({
            success: true,
            message: 'Webhook processed — appointment updated',
            data: {
                appointmentId: appointment._id,
                paymentStatus: appointment.paymentStatus,
                status: appointment.status
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Legacy: pay for a specific appointment (returns gateway order via create-order flow)
// @route   POST /api/patients/appointments/:id/pay
// @access  Private (Patient)
exports.payAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { paymentMethod } = req.body;

        if (!paymentMethod) {
            return next(new ErrorResponse('Please specify a payment method (COD, Card, UPI)', 400));
        }

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        const patient = await Patient.findOne({ userId: req.user._id });
        if (!patient || appointment.patientId.toString() !== patient._id.toString()) {
            return next(new ErrorResponse('Not authorized to pay for this appointment', 403));
        }

        if (appointment.paymentStatus === 'completed') {
            return next(new ErrorResponse('Appointment is already paid', 400));
        }

        const rzp = getRazorpay();
        const amountInPaise = Math.round((appointment.amount || 500) * 100);

        if (!rzp) {
            const mockOrderId = 'order_mock_' + helpers.generateRandomString(12);
            return res.status(200).json({
                success: true,
                message: 'Mock payment intent created successfully',
                data: {
                    orderId: mockOrderId,
                    amount: appointment.amount || 500,
                    currency: 'INR',
                    status: 'created',
                    paymentMethod,
                    appointmentId: appointment._id,
                    mode: 'mock'
                }
            });
        }

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `rcpt_apt_${appointment._id}`,
            notes: {
                purpose: 'appointment',
                referenceId: appointment._id.toString(),
                appointmentId: appointment._id.toString(),
                userId: req.user._id.toString()
            }
        };

        const razorpayOrder = await rzp.orders.create(options);

        res.status(200).json({
            success: true,
            message: 'Payment order created successfully',
            data: {
                orderId: razorpayOrder.id,
                amount: appointment.amount || 500,
                currency: 'INR',
                status: 'created',
                paymentMethod,
                appointmentId: appointment._id,
                keyId: process.env.RAZORPAY_KEY_ID,
                mode: 'live'
            }
        });
    } catch (error) {
        next(error);
    }
};
