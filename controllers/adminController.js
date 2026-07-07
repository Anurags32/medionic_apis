const User = require('../models/User');
const Doctor = require('../models/Doctor');
const MedicalRep = require('../models/MedicalRep');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Expense = require('../models/Expense');
const ErrorResponse = require('../utils/errorResponse');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');

// @desc    Admin Login
// @route   POST /api/auth/admin/login
// @access  Public
exports.adminLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return next(new ErrorResponse('Please provide email and password', 400));
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return next(new ErrorResponse('Invalid credentials', 401));
        }

        if (user.role !== constants.ROLES.ADMIN) {
            return next(new ErrorResponse('Not authorized as an admin', 403));
        }

        if (!user.isActive()) {
            return next(new ErrorResponse('Account is not active', 403));
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return next(new ErrorResponse('Invalid credentials', 401));
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Admin login successful',
            data: {
                userId: user._id,
                email: user.email,
                role: user.role,
                status: user.status,
                profileComplete: true
            },
            token,
            refreshToken
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctors list (filterable by status)
// @route   GET /api/admin/doctors
// @access  Private/Admin
exports.getDoctors = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) {
            query.verificationStatus = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const doctors = await Doctor.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Doctor.countDocuments(query);

        res.status(200).json({
            success: true,
            data: doctors,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify Doctor
// @route   PUT /api/admin/doctors/:id/verify
// @access  Private/Admin
exports.verifyDoctor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        if (!status || !['verified', 'rejected'].includes(status)) {
            return next(new ErrorResponse('Status must be verified or rejected', 400));
        }

        const doctor = await Doctor.findById(id);
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        doctor.verificationStatus = status;
        if (remarks) {
            doctor.bio = doctor.bio ? `${doctor.bio}\n[Admin Note]: ${remarks}` : `[Admin Note]: ${remarks}`;
        }
        await doctor.save();

        // Update corresponding User isVerified status
        if (status === 'verified') {
            await User.findByIdAndUpdate(doctor.userId, { isVerified: true });
        } else {
            await User.findByIdAndUpdate(doctor.userId, { isVerified: false });
        }

        res.status(200).json({
            success: true,
            message: `Doctor verification status updated to ${status}`,
            data: doctor
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get MR list (filterable by status)
// @route   GET /api/admin/mr
// @access  Private/Admin
exports.getMRs = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status) {
            query.verificationStatus = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const mrs = await MedicalRep.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await MedicalRep.countDocuments(query);

        res.status(200).json({
            success: true,
            data: mrs,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Verify MR
// @route   PUT /api/admin/mr/:id/verify
// @access  Private/Admin
exports.verifyMR = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        if (!status || !['verified', 'rejected'].includes(status)) {
            return next(new ErrorResponse('Status must be verified or rejected', 400));
        }

        const mr = await MedicalRep.findById(id);
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        mr.verificationStatus = status;
        if (remarks) {
            // we can log MR remarks or append to designation/description. Let's save remarks if possible.
            mr.remarks = remarks;
        }
        await mr.save();

        // Update corresponding User isVerified status
        if (status === 'verified') {
            await User.findByIdAndUpdate(mr.userId, { isVerified: true });
        } else {
            await User.findByIdAndUpdate(mr.userId, { isVerified: false });
        }

        res.status(200).json({
            success: true,
            message: `MR verification status updated to ${status}`,
            data: mr
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all platform users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
    try {
        const { role, status, search, page = 1, limit = 10 } = req.query;
        const query = {};

        if (role) query.role = role;
        if (status) query.status = status;
        
        if (search) {
            query.email = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const users = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Suspend/Unsuspend User
// @route   PUT /api/admin/users/:id/suspend
// @access  Private/Admin
exports.suspendUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        if (user.role === constants.ROLES.ADMIN) {
            return next(new ErrorResponse('Admin accounts cannot be suspended', 400));
        }

        // Toggle status
        user.status = user.status === constants.USER_STATUS.ACTIVE 
            ? constants.USER_STATUS.SUSPENDED 
            : constants.USER_STATUS.ACTIVE;

        await user.save();

        res.status(200).json({
            success: true,
            message: `User status toggled successfully to ${user.status}`,
            data: {
                userId: user._id,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Platform wide dashboard analytics stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboard = async (req, res, next) => {
    try {
        const totalPatients = await Patient.countDocuments();
        const totalDoctors = await Doctor.countDocuments();
        const totalMRs = await MedicalRep.countDocuments();
        const totalAppointments = await Appointment.countDocuments();

        // Calculate total platform revenue from completed appointments
        const completedAppointments = await Appointment.find({ paymentStatus: 'completed' });
        const revenue = completedAppointments.reduce((sum, apt) => sum + (apt.amount || 0), 0);

        res.status(200).json({
            success: true,
            data: {
                totalPatients,
                totalDoctors,
                totalMRs,
                totalAppointments,
                totalRevenue: revenue
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get pending MR expenses
// @route   GET /api/admin/expenses/pending-approvals
// @access  Private/Admin
exports.getPendingExpenses = async (req, res, next) => {
    try {
        const expenses = await Expense.find({ approvalStatus: 'pending' })
            .populate('mrId', 'email')
            .sort({ date: 1 });

        res.status(200).json({
            success: true,
            data: expenses
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve Expense
// @route   PUT /api/admin/expenses/:id/approve
// @access  Private/Admin
exports.approveExpense = async (req, res, next) => {
    try {
        const { id } = req.params;

        const expense = await Expense.findById(id);
        if (!expense) {
            return next(new ErrorResponse('Expense record not found', 404));
        }

        expense.approvalStatus = 'approved';
        await expense.save();

        res.status(200).json({
            success: true,
            message: 'Expense approved successfully',
            data: expense
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reject Expense
// @route   PUT /api/admin/expenses/:id/reject
// @access  Private/Admin
exports.rejectExpense = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const expense = await Expense.findById(id);
        if (!expense) {
            return next(new ErrorResponse('Expense record not found', 404));
        }

        expense.approvalStatus = 'rejected';
        if (remarks) {
            expense.remarks = remarks;
        }
        await expense.save();

        res.status(200).json({
            success: true,
            message: 'Expense rejected successfully',
            data: expense
        });
    } catch (error) {
        next(error);
    }
};
