const LabTest = require('../models/LabTest');
const LabBooking = require('../models/LabBooking');
const Patient = require('../models/Patient');
const ErrorResponse = require('../utils/errorResponse');
const helpers = require('../utils/helpers');

// @desc    Get all lab tests (with optional search)
// @route   GET /api/lab/tests?search=
// @access  Private
exports.getLabTests = async (req, res, next) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const query = {};

        if (search && search.trim()) {
            query.$or = [
                { name: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } },
                { sampleType: { $regex: search.trim(), $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [tests, total] = await Promise.all([
            LabTest.find(query).skip(skip).limit(parseInt(limit)).sort({ name: 1 }),
            LabTest.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: tests,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single lab test
// @route   GET /api/lab/tests/:id
// @access  Private
exports.getLabTest = async (req, res, next) => {
    try {
        const test = await LabTest.findById(req.params.id);
        if (!test) {
            return next(new ErrorResponse('Lab test not found', 404));
        }
        res.status(200).json({ success: true, data: test });
    } catch (error) {
        next(error);
    }
};

// @desc    Book lab tests
// @route   POST /api/lab/bookings
// @access  Private (Patient)
exports.bookLabTest = async (req, res, next) => {
    try {
        const { testIds, scheduledAt, address } = req.body;

        if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
            return next(new ErrorResponse('Please provide at least one test ID', 400));
        }
        if (!scheduledAt) {
            return next(new ErrorResponse('Please provide a scheduled date and time', 400));
        }
        if (!address || address.trim().length === 0) {
            return next(new ErrorResponse('Please provide a sample collection address', 400));
        }

        // Verify all test IDs exist
        const tests = await LabTest.find({ _id: { $in: testIds } });
        if (tests.length !== testIds.length) {
            return next(new ErrorResponse('One or more lab test IDs are invalid', 400));
        }

        // Validate scheduled date is in the future
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return next(new ErrorResponse('Invalid scheduled date format', 400));
        }
        if (scheduledDate <= new Date()) {
            return next(new ErrorResponse('Scheduled date must be in the future', 400));
        }

        // Find patient profile
        const patient = await Patient.findOne({ userId: req.user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const booking = await LabBooking.create({
            patientId: patient._id,
            testIds,
            scheduledAt: scheduledDate,
            address: address.trim(),
            status: 'pending'
        });

        // Populate tests in response
        const populatedBooking = await LabBooking.findById(booking._id).populate('testIds');

        const totalAmount = tests.reduce((sum, t) => sum + t.price, 0);

        res.status(201).json({
            success: true,
            message: 'Lab test booked successfully',
            data: {
                booking: populatedBooking,
                tests,
                totalAmount
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get patient's lab bookings
// @route   GET /api/lab/bookings
// @access  Private (Patient)
exports.getMyLabBookings = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const patient = await Patient.findOne({ userId: req.user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const query = { patientId: patient._id };
        if (status) query.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [bookings, total] = await Promise.all([
            LabBooking.find(query)
                .populate('testIds')
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 }),
            LabBooking.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: bookings,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};
