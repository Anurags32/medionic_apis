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
// Pharmacy subsystem models
const PharmacyUser = require('../models/pharmacy/user.model');
const PharmacyBranch = require('../models/pharmacy/branch.model');
const { ROLES: PHARMACY_ROLES } = require('../config/pharmacyConstants');


// ─── ADMIN REGISTRATION ──────────────────────────────────────────────────────
exports.adminRegister = async (req, res, next) => {
    try {
        const { fullName, email, password, secretKey } = req.body;

        if (!fullName || !email || !password || !secretKey) {
            return next(new ErrorResponse('Please provide fullName, email, password, and secretKey', 400));
        }

        // Validate secret key from environment
        const validSecret = process.env.ADMIN_REGISTRATION_SECRET;
        if (!validSecret || secretKey !== validSecret) {
            return next(new ErrorResponse('Invalid secret key. Admin registration not authorized.', 403));
        }

        // Only allow if no admin exists yet
        const existingAdmin = await User.findOne({ role: constants.ROLES.ADMIN });
        if (existingAdmin) {
            return next(new ErrorResponse('An admin account already exists. Contact your super admin.', 409));
        }

        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return next(new ErrorResponse('Email already registered', 400));
        }

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        const adminUser = await User.create({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            role: constants.ROLES.ADMIN,
            status: constants.USER_STATUS.ACTIVE,
            isVerified: true,
            profileComplete: true,
        });

        const token = generateToken(adminUser._id);
        const refreshToken = generateRefreshToken(adminUser._id);

        res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            data: {
                userId: adminUser._id,
                email: adminUser.email,
                role: adminUser.role,
                firstName: adminUser.firstName,
                lastName: adminUser.lastName,
            },
            token,
            refreshToken,
        });
    } catch (error) {
        next(error);
    }
};

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
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
            mr.remarks = remarks;
        }
        await mr.save();
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


exports.getDashboard = async (req, res, next) => {
    try {
        const totalPatients = await Patient.countDocuments();
        const totalDoctors = await Doctor.countDocuments();
        const totalMRs = await MedicalRep.countDocuments();
        const totalAppointments = await Appointment.countDocuments();
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

exports.getDoctorProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const doctor = await Doctor.findById(id).populate('userId', 'email role status isVerified lastLogin');
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: doctor
        });
    } catch (error) {
        next(error);
    }
};

exports.getMRProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const mr = await MedicalRep.findById(id).populate('userId', 'email role status isVerified lastLogin');
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: mr
        });
    } catch (error) {
        next(error);
    }
};

exports.approveDoctor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const doctor = await Doctor.findById(id);
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        doctor.verificationStatus = 'verified';
        if (remarks) {
            doctor.bio = doctor.bio ? `${doctor.bio}\n[Admin Note]: ${remarks}` : `[Admin Note]: ${remarks}`;
        }
        await doctor.save();

        await User.findByIdAndUpdate(doctor.userId, { isVerified: true });

        res.status(200).json({
            success: true,
            message: 'Doctor profile approved successfully',
            data: doctor
        });
    } catch (error) {
        next(error);
    }
};

exports.rejectDoctor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const doctor = await Doctor.findById(id);
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        doctor.verificationStatus = 'rejected';
        if (remarks) {
            doctor.bio = doctor.bio ? `${doctor.bio}\n[Admin Note]: ${remarks}` : `[Admin Note]: ${remarks}`;
        }
        await doctor.save();

        await User.findByIdAndUpdate(doctor.userId, { isVerified: false });

        res.status(200).json({
            success: true,
            message: 'Doctor profile rejected successfully',
            data: doctor
        });
    } catch (error) {
        next(error);
    }
};

exports.approveMR = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const mr = await MedicalRep.findById(id);
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        mr.verificationStatus = 'verified';
        if (remarks) {
            mr.remarks = remarks;
        }
        await mr.save();

        await User.findByIdAndUpdate(mr.userId, { isVerified: true });

        res.status(200).json({
            success: true,
            message: 'MR profile approved successfully',
            data: mr
        });
    } catch (error) {
        next(error);
    }
};

exports.rejectMR = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const mr = await MedicalRep.findById(id);
        if (!mr) {
            return next(new ErrorResponse('MR profile not found', 404));
        }

        mr.verificationStatus = 'rejected';
        if (remarks) {
            mr.remarks = remarks;
        }
        await mr.save();

        await User.findByIdAndUpdate(mr.userId, { isVerified: false });

        res.status(200).json({
            success: true,
            message: 'MR profile rejected successfully',
            data: mr
        });
    } catch (error) {
        next(error);
    }
};

// ─── PATIENTS ────────────────────────────────────────────────────────────────
exports.getPatients = async (req, res, next) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const query = { role: constants.ROLES.PATIENT };

        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const patients = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: patients,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.getPatientProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const patient = await Patient.findOne({ userId: id }).populate('userId', '-password');
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: patient
        });
    } catch (error) {
        next(error);
    }
};

// ─── PHARMACY OWNERS ─────────────────────────────────────────────────────────
exports.getPharmacyOwners = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = { role: PHARMACY_ROLES.PHARMACY_OWNER };

        if (status) {
            query.approval_status = status; // 'pending' | 'approved' | 'rejected'
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const owners = await PharmacyUser.find(query)
            .populate('branch')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ created_at: -1 });

        const total = await PharmacyUser.countDocuments(query);

        res.status(200).json({
            success: true,
            data: owners,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.approvePharmacyOwner = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const owner = await PharmacyUser.findOne({ _id: id, role: PHARMACY_ROLES.PHARMACY_OWNER });
        if (!owner) {
            return next(new ErrorResponse('Pharmacy owner not found', 404));
        }

        owner.approval_status = 'approved';
        owner.is_active = true;
        if (remarks) owner.approval_remarks = remarks;
        await owner.save();

        // Also update the branch to mark as active
        await PharmacyBranch.findByIdAndUpdate(owner.branch_id, { is_active: true });

        res.status(200).json({
            success: true,
            message: 'Pharmacy owner approved successfully. They can now login.',
            data: owner
        });
    } catch (error) {
        next(error);
    }
};

exports.rejectPharmacyOwner = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const owner = await PharmacyUser.findOne({ _id: id, role: PHARMACY_ROLES.PHARMACY_OWNER });
        if (!owner) {
            return next(new ErrorResponse('Pharmacy owner not found', 404));
        }

        owner.approval_status = 'rejected';
        owner.is_active = false;
        if (remarks) owner.approval_remarks = remarks;
        await owner.save();

        res.status(200).json({
            success: true,
            message: 'Pharmacy owner registration rejected.',
            data: owner
        });
    } catch (error) {
        next(error);
    }
};

exports.getPharmacyOwnerProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const owner = await PharmacyUser.findOne({ _id: id, role: PHARMACY_ROLES.PHARMACY_OWNER }).populate('branch');
        if (!owner) {
            return next(new ErrorResponse('Pharmacy owner not found', 404));
        }

        res.status(200).json({
            success: true,
            data: owner
        });
    } catch (error) {
        next(error);
    }
};
