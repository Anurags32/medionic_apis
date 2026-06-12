const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const ErrorResponse = require('../utils/errorResponse');
const constants = require('../config/constants');

// @desc    Get revenue analytics
// @route   GET /api/doctors/analytics/revenue
// @access  Private/Doctor
exports.getRevenueAnalytics = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const doctorId = req.user._id;

        const doctor = await Doctor.findOne({ userId: doctorId });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const startDate = month && year
            ? new Date(year, month - 1, 1)
            : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const appointments = await Appointment.find({
            doctorId: doctor._id,
            status: constants.APPOINTMENT_STATUS.COMPLETED,
            completedAt: { $gte: startDate, $lt: endDate }
        }).populate('patientId');

        const totalRevenue = appointments.reduce((sum, apt) => {
            return sum + (doctor.consultationFee || 0);
        }, 0);

        const appointmentCount = appointments.length;
        const avgRevenue = appointmentCount > 0 ? totalRevenue / appointmentCount : 0;

        res.status(200).json({
            success: true,
            message: 'Revenue analytics retrieved',
            data: {
                period: `${month || 'Current'}-${year || new Date().getFullYear()}`,
                totalRevenue,
                appointmentCount,
                avgRevenue,
                consultationFee: doctor.consultationFee,
                appointments: appointments.map(a => ({
                    _id: a._id,
                    patientName: a.patientId?.firstName + ' ' + a.patientId?.lastName,
                    date: a.completedAt,
                    fee: doctor.consultationFee
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get rating analytics
// @route   GET /api/doctors/analytics/ratings
// @access  Private/Doctor
exports.getRatingAnalytics = async (req, res, next) => {
    try {
        const doctorId = req.user._id;

        const doctor = await Doctor.findOne({ userId: doctorId });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const ratingBreakdown = {
            5: doctor.ratings?.filter(r => r.rating === 5).length || 0,
            4: doctor.ratings?.filter(r => r.rating === 4).length || 0,
            3: doctor.ratings?.filter(r => r.rating === 3).length || 0,
            2: doctor.ratings?.filter(r => r.rating === 2).length || 0,
            1: doctor.ratings?.filter(r => r.rating === 1).length || 0
        };

        const totalReviews = Object.values(ratingBreakdown).reduce((a, b) => a + b, 0);
        const avgRating = doctor.rating || 0;

        res.status(200).json({
            success: true,
            message: 'Rating analytics retrieved',
            data: {
                averageRating: avgRating,
                totalReviews,
                ratingBreakdown,
                recentReviews: (doctor.ratings || []).slice(-5).map(r => ({
                    rating: r.rating,
                    comment: r.comment,
                    date: r.date
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get appointment trends
// @route   GET /api/doctors/analytics/appointments
// @access  Private/Doctor
exports.getAppointmentTrends = async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const doctorId = req.user._id;

        const doctor = await Doctor.findOne({ userId: doctorId });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const appointments = await Appointment.find({
            doctorId: doctor._id,
            appointmentDate: { $gte: startDate }
        }).sort('appointmentDate');

        // Group by date
        const trendsMap = {};
        appointments.forEach(apt => {
            const date = new Date(apt.appointmentDate).toLocaleDateString();
            trendsMap[date] = (trendsMap[date] || 0) + 1;
        });

        const trends = Object.entries(trendsMap).map(([date, count]) => ({
            date,
            count
        }));

        res.status(200).json({
            success: true,
            message: 'Appointment trends retrieved',
            data: {
                period: `Last ${days} days`,
                totalAppointments: appointments.length,
                trends
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get earnings data
// @route   GET /api/doctors/earnings
// @access  Private/Doctor
exports.getEarnings = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const doctorId = req.user._id;

        const doctor = await Doctor.findOne({ userId: doctorId });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const startDate = month && year
            ? new Date(year, month - 1, 1)
            : new Date();
        startDate.setDate(1);

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const completedAppointments = await Appointment.find({
            doctorId: doctor._id,
            status: constants.APPOINTMENT_STATUS.COMPLETED,
            completedAt: { $gte: startDate, $lt: endDate }
        });

        const totalEarned = completedAppointments.length * (doctor.consultationFee || 0);
        const pendingAmount = doctor.pendingWithdrawal || 0;
        const totalCompleted = doctor.totalEarnings || 0;

        res.status(200).json({
            success: true,
            message: 'Earnings data retrieved',
            data: {
                currentMonth: {
                    earned: totalEarned,
                    appointments: completedAppointments.length
                },
                pending: pendingAmount,
                totalCompleted,
                consultationFee: doctor.consultationFee,
                withdrawals: doctor.withdrawalHistory || []
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Request withdrawal
// @route   POST /api/doctors/earnings/withdraw
// @access  Private/Doctor
exports.requestWithdrawal = async (req, res, next) => {
    try {
        const { amount, bankDetails } = req.body;
        const doctorId = req.user._id;

        if (!amount || amount <= 0) {
            return next(new ErrorResponse('Valid amount is required', 400));
        }

        if (!bankDetails || !bankDetails.accountNumber || !bankDetails.ifscCode) {
            return next(new ErrorResponse('Valid bank details are required', 400));
        }

        const doctor = await Doctor.findOne({ userId: doctorId });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const availableAmount = doctor.pendingWithdrawal || 0;
        if (amount > availableAmount) {
            return next(new ErrorResponse('Insufficient balance for withdrawal', 400));
        }

        const withdrawal = {
            _id: new require('mongoose').Types.ObjectId(),
            amount,
            bankDetails,
            status: 'pending',
            requestedAt: new Date(),
            processedAt: null
        };

        if (!doctor.withdrawalHistory) {
            doctor.withdrawalHistory = [];
        }

        doctor.withdrawalHistory.push(withdrawal);
        doctor.pendingWithdrawal = (doctor.pendingWithdrawal || 0) - amount;
        await doctor.save();

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted',
            data: withdrawal
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get earnings history
// @route   GET /api/doctors/earnings/history
// @access  Private/Doctor
exports.getEarningsHistory = async (req, res, next) => {
    try {
        const doctorId = req.user._id;
        const { limit = 20, skip = 0 } = req.query;

        const doctor = await Doctor.findOne({ userId: doctorId });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const history = doctor.withdrawalHistory || [];
        const total = history.length;

        const withdrawals = history
            .sort((a, b) => b.requestedAt - a.requestedAt)
            .slice(parseInt(skip), parseInt(skip) + parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Earnings history retrieved',
            data: {
                total,
                count: withdrawals.length,
                withdrawals
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify profile documents
// @route   POST /api/doctors/profile/verify
// @access  Private/Doctor
exports.submitVerificationDocuments = async (req, res, next) => {
    try {
        const doctorId = req.user._id;
        const { licenseNumber, certificateFiles } = req.body;

        if (!licenseNumber) {
            return next(new ErrorResponse('License number is required', 400));
        }

        const doctor = await Doctor.findOne({ userId: doctorId });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        doctor.licenseNumber = licenseNumber;
        doctor.verificationStatus = constants.VERIFICATION_STATUS.PENDING;

        if (req.files) {
            doctor.certificateFiles = req.files.map(f => ({
                name: f.originalname,
                url: `/uploads/${f.filename}`,
                uploadedAt: new Date()
            }));
        }

        await doctor.save();

        res.status(200).json({
            success: true,
            message: 'Verification documents submitted. Approval pending.',
            data: {
                verificationStatus: doctor.verificationStatus,
                licenseNumber: doctor.licenseNumber
            }
        });
    } catch (error) {
        next(error);
    }
};
