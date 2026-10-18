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
const PharmacyOrder = require('../models/PharmacyOrder');
const { Invoice: PharmacyInvoice } = require('../models/pharmacy');
const { ROLES: PHARMACY_ROLES } = require('../config/pharmacyConstants');


// ─── ADMIN REGISTRATION ──────────────────────────────────────────────────────
exports.adminRegister = async (req, res, next) => {
    try {
        const { fullName, email, password, secretKey, phone } = req.body;

        if (!fullName || !email || !password || !secretKey) {
            return next(new ErrorResponse('Please provide fullName, email, password, and secretKey', 400));
        }

        // Validate secret key from environment
        const validSecret = process.env.ADMIN_REGISTRATION_SECRET;
        if (!validSecret || secretKey !== validSecret) {
            return next(new ErrorResponse('Invalid secret key. Admin registration not authorized.', 403));
        }

        // Check if email already registered
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return next(new ErrorResponse('Email already registered', 400));
        }

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        const userData = {
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            role: constants.ROLES.ADMIN,
            status: constants.USER_STATUS.ACTIVE,
            isVerified: true,
            profileComplete: true,
        };

        if (phone && String(phone).trim()) {
            userData.phone = String(phone).trim();
        }

        const adminUser = await User.create(userData);

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

// ─── ADMIN PAYMENTS & REVENUE MANAGEMENT ─────────────────────────────────────

exports.getPaymentDashboard = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = {};
        if (startDate || endDate) {
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.$lte = end;
            }
        }

        const aptDateQuery = dateFilter.$gte || dateFilter.$lte ? { appointmentDate: dateFilter } : {};
        const invoiceDateQuery = dateFilter.$gte || dateFilter.$lte ? { invoice_date: dateFilter } : {};
        const orderDateQuery = dateFilter.$gte || dateFilter.$lte ? { createdAt: dateFilter } : {};
        const expenseDateQuery = dateFilter.$gte || dateFilter.$lte ? { date: dateFilter } : {};

        // 1. Doctor Appointment Consultation Payments
        const [aptCompleted, aptPending, aptRefunded] = await Promise.all([
            Appointment.find({ ...aptDateQuery, paymentStatus: 'completed' }),
            Appointment.countDocuments({ ...aptDateQuery, paymentStatus: 'pending' }),
            Appointment.countDocuments({ ...aptDateQuery, paymentStatus: 'refunded' }),
        ]);
        const doctorRevenue = aptCompleted.reduce((sum, apt) => sum + (Number(apt.amount) || 0), 0);
        const doctorCompletedCount = aptCompleted.length;

        // 2. Pharmacy Invoices (POS & Branch sales)
        const pharmacyInvoices = await PharmacyInvoice.find(invoiceDateQuery);
        let pharmacyInvoiceRevenue = 0;
        let pharmacyTaxCollected = 0;
        let pharmacyDiscountGiven = 0;
        const posPaymentModes = { CASH: 0, UPI: 0, CARD: 0, KHATA: 0, OTHER: 0 };

        pharmacyInvoices.forEach((inv) => {
            const total = Number(inv.grand_total) || 0;
            pharmacyInvoiceRevenue += total;
            pharmacyTaxCollected += (Number(inv.total_tax) || (Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0)));
            pharmacyDiscountGiven += (Number(inv.discount_amount) || 0);

            const mode = (inv.payment_mode || 'OTHER').toUpperCase();
            if (posPaymentModes[mode] !== undefined) {
                posPaymentModes[mode] += total;
            } else {
                posPaymentModes.OTHER += total;
            }
        });

        // 3. Pharmacy Online Orders (Patient App orders)
        const [pharmacyOrdersCompleted, pharmacyOrdersPending] = await Promise.all([
            PharmacyOrder.find({ ...orderDateQuery, paymentStatus: 'completed' }),
            PharmacyOrder.countDocuments({ ...orderDateQuery, paymentStatus: 'pending' }),
        ]);
        const pharmacyOrderRevenue = pharmacyOrdersCompleted.reduce((sum, ord) => sum + (Number(ord.finalAmount) || 0), 0);

        // 4. MR Expenses (Company Expense Reimbursements)
        const [mrExpensesApproved, mrExpensesPending] = await Promise.all([
            Expense.find({ ...expenseDateQuery, approvalStatus: 'approved' }),
            Expense.find({ ...expenseDateQuery, approvalStatus: 'pending' }),
        ]);
        const mrApprovedTotal = mrExpensesApproved.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        const mrPendingTotal = mrExpensesPending.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

        // Overall Totals
        const totalGrossRevenue = doctorRevenue + pharmacyInvoiceRevenue + pharmacyOrderRevenue;
        const netCompanyBalance = totalGrossRevenue - mrApprovedTotal;

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalGrossRevenue: Number(totalGrossRevenue.toFixed(2)),
                    netCompanyBalance: Number(netCompanyBalance.toFixed(2)),
                    currency: 'INR',
                },
                breakdown: {
                    doctorConsultations: {
                        totalRevenue: Number(doctorRevenue.toFixed(2)),
                        completedAppointments: doctorCompletedCount,
                        pendingAppointments: aptPending,
                        refundedAppointments: aptRefunded,
                    },
                    pharmacyPOS: {
                        totalRevenue: Number(pharmacyInvoiceRevenue.toFixed(2)),
                        totalInvoices: pharmacyInvoices.length,
                        taxCollected: Number(pharmacyTaxCollected.toFixed(2)),
                        discountsGiven: Number(pharmacyDiscountGiven.toFixed(2)),
                        byPaymentMode: posPaymentModes,
                    },
                    pharmacyOnlineOrders: {
                        totalRevenue: Number(pharmacyOrderRevenue.toFixed(2)),
                        completedOrders: pharmacyOrdersCompleted.length,
                        pendingOrders: pharmacyOrdersPending,
                    },
                    mrExpenses: {
                        approvedPayouts: Number(mrApprovedTotal.toFixed(2)),
                        approvedCount: mrExpensesApproved.length,
                        pendingApprovals: Number(mrPendingTotal.toFixed(2)),
                        pendingCount: mrExpensesPending.length,
                    },
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.getAllPaymentTransactions = async (req, res, next) => {
    try {
        const { source, status, search, page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;

        let transactions = [];

        // 1. Appointments
        if (!source || source === 'all' || source === 'doctor_appointment') {
            const aptQuery = {};
            if (status) aptQuery.paymentStatus = status.toLowerCase();
            const appointments = await Appointment.find(aptQuery)
                .populate('patientId', 'firstName lastName email phone')
                .populate('doctorId', 'firstName lastName specialization clinicName')
                .sort({ appointmentDate: -1 })
                .limit(200);

            appointments.forEach((apt) => {
                const patientName = apt.patientId ? `${apt.patientId.firstName || ''} ${apt.patientId.lastName || ''}`.trim() : 'Patient';
                const doctorName = apt.doctorId ? `Dr. ${apt.doctorId.firstName || ''} ${apt.doctorId.lastName || ''}`.trim() : 'Doctor';

                transactions.push({
                    id: apt._id.toString(),
                    source: 'doctor_appointment',
                    sourceLabel: 'Doctor Consultation Appointment',
                    referenceNumber: apt.meetingId || `APT-${apt._id.toString().slice(-6).toUpperCase()}`,
                    amount: Number(apt.amount) || 0,
                    currency: 'INR',
                    status: (apt.paymentStatus || 'pending').toUpperCase(),
                    paymentMethod: apt.paymentMethod || 'COD',
                    transactionId: apt.transactionId || null,
                    date: apt.appointmentDate || apt.createdAt,
                    payer: {
                        id: apt.patientId?._id?.toString() || null,
                        name: patientName,
                        email: apt.patientId?.email || null,
                        phone: apt.patientId?.phone || null,
                        type: 'PATIENT',
                    },
                    payeeOrEntity: {
                        id: apt.doctorId?._id?.toString() || null,
                        name: doctorName,
                        specialization: apt.doctorId?.specialization || null,
                        type: 'DOCTOR',
                    },
                });
            });
        }

        // 2. Pharmacy Invoices (POS)
        if (!source || source === 'all' || source === 'pharmacy_pos') {
            const invQuery = {};
            if (status) invQuery.payment_status = status.toUpperCase();
            const invoices = await PharmacyInvoice.find(invQuery)
                .populate('branch_id', 'name code address contact_number')
                .populate('customer_id', 'name phone')
                .populate('created_by_user_id', 'full_name role')
                .sort({ invoice_date: -1 })
                .limit(200);

            invoices.forEach((inv) => {
                transactions.push({
                    id: inv._id.toString(),
                    source: 'pharmacy_pos',
                    sourceLabel: 'Pharmacy POS Invoice',
                    referenceNumber: inv.invoice_number,
                    amount: Number(inv.grand_total) || 0,
                    taxAmount: Number(inv.total_tax) || (Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0)),
                    discountAmount: Number(inv.discount_amount) || 0,
                    currency: 'INR',
                    status: (inv.payment_status || 'COMPLETED').toUpperCase(),
                    paymentMethod: inv.payment_mode || 'CASH',
                    transactionId: null,
                    date: inv.invoice_date || inv.created_at,
                    payer: {
                        id: inv.customer_id?._id?.toString() || null,
                        name: inv.patient_name || inv.customer_id?.name || 'Walk-in Customer',
                        phone: inv.customer_id?.phone || null,
                        type: 'CUSTOMER',
                    },
                    payeeOrEntity: {
                        id: inv.branch_id?._id?.toString() || null,
                        name: inv.branch_id?.name || 'Pharmacy Branch',
                        code: inv.branch_id?.code || null,
                        address: inv.branch_id?.address || null,
                        type: 'PHARMACY_BRANCH',
                    },
                    staff: inv.created_by_user_id ? {
                        id: inv.created_by_user_id._id?.toString(),
                        name: inv.created_by_user_id.full_name,
                        role: inv.created_by_user_id.role,
                    } : null,
                });
            });
        }

        // 3. Pharmacy Online Orders
        if (!source || source === 'all' || source === 'pharmacy_order') {
            const ordQuery = {};
            if (status) ordQuery.paymentStatus = status.toLowerCase();
            const orders = await PharmacyOrder.find(ordQuery)
                .populate('patientId', 'firstName lastName email phone')
                .sort({ createdAt: -1 })
                .limit(200);

            orders.forEach((ord) => {
                const patientName = ord.patientId ? `${ord.patientId.firstName || ''} ${ord.patientId.lastName || ''}`.trim() : 'Patient';

                transactions.push({
                    id: ord._id.toString(),
                    source: 'pharmacy_order',
                    sourceLabel: 'Pharmacy Patient Online Order',
                    referenceNumber: ord.orderNumber,
                    amount: Number(ord.finalAmount) || Number(ord.totalAmount) || 0,
                    taxAmount: Number(ord.taxAmount) || 0,
                    discountAmount: Number(ord.discountApplied) || 0,
                    currency: 'INR',
                    status: (ord.paymentStatus || 'pending').toUpperCase(),
                    paymentMethod: ord.paymentMethod || 'COD',
                    transactionId: ord.transactionId || null,
                    date: ord.createdAt,
                    payer: {
                        id: ord.patientId?._id?.toString() || null,
                        name: patientName,
                        email: ord.patientId?.email || null,
                        phone: ord.patientId?.phone || null,
                        type: 'PATIENT',
                    },
                    payeeOrEntity: {
                        name: 'Central Pharmacy Fulfillment',
                        type: 'PHARMACY_ONLINE',
                    },
                    itemCount: ord.medicines?.length || 0,
                });
            });
        }

        // 4. MR Expenses / Payouts
        if (!source || source === 'all' || source === 'mr_expense') {
            const expQuery = {};
            if (status) expQuery.approvalStatus = status.toLowerCase();
            const expenses = await Expense.find(expQuery)
                .populate('mrId', 'firstName lastName email phone')
                .sort({ date: -1 })
                .limit(200);

            expenses.forEach((exp) => {
                const mrName = exp.mrId ? `${exp.mrId.firstName || ''} ${exp.mrId.lastName || ''}`.trim() || exp.mrId.email : 'Medical Rep';

                transactions.push({
                    id: exp._id.toString(),
                    source: 'mr_expense',
                    sourceLabel: 'MR Expense Reimbursement',
                    referenceNumber: `EXP-${exp._id.toString().slice(-6).toUpperCase()}`,
                    amount: Number(exp.amount) || 0,
                    currency: 'INR',
                    status: (exp.approvalStatus || exp.status || 'pending').toUpperCase(),
                    paymentMethod: 'REIMBURSEMENT',
                    transactionId: null,
                    date: exp.date || exp.createdAt,
                    payer: {
                        name: 'Company / HealthCare+',
                        type: 'ADMIN_COMPANY',
                    },
                    payeeOrEntity: {
                        id: exp.mrId?._id?.toString() || null,
                        name: mrName,
                        email: exp.mrId?.email || null,
                        phone: exp.mrId?.phone || null,
                        type: 'MEDICAL_REP',
                    },
                    category: exp.category || exp.expenseType || 'General',
                    receiptUrl: exp.receiptUrl || null,
                });
            });
        }

        // Optional search filter
        if (search) {
            const s = search.toLowerCase();
            transactions = transactions.filter((t) =>
                (t.referenceNumber && t.referenceNumber.toLowerCase().includes(s)) ||
                (t.transactionId && t.transactionId.toLowerCase().includes(s)) ||
                (t.payer?.name && t.payer.name.toLowerCase().includes(s)) ||
                (t.payeeOrEntity?.name && t.payeeOrEntity.name.toLowerCase().includes(s))
            );
        }

        // Sort descending by date
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Paginate in-memory
        const total = transactions.length;
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedData = transactions.slice(startIndex, startIndex + limitNum);

        res.status(200).json({
            success: true,
            data: paginatedData,
            pagination: helpers.generatePagination(pageNum, limitNum, total),
        });
    } catch (error) {
        next(error);
    }
};

exports.getAppointmentPayments = async (req, res, next) => {
    try {
        const { paymentStatus, doctorId, patientId, page = 1, limit = 10 } = req.query;
        const query = {};
        if (paymentStatus) query.paymentStatus = paymentStatus.toLowerCase();
        if (doctorId) query.doctorId = doctorId;
        if (patientId) query.patientId = patientId;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const [appointments, total] = await Promise.all([
            Appointment.find(query)
                .populate('patientId', 'firstName lastName email phone')
                .populate('doctorId', 'firstName lastName specialization clinicName phone email')
                .skip(skip)
                .limit(parseInt(limit, 10))
                .sort({ appointmentDate: -1 }),
            Appointment.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            data: appointments,
            pagination: helpers.generatePagination(page, limit, total),
        });
    } catch (error) {
        next(error);
    }
};

exports.getPharmacyInvoices = async (req, res, next) => {
    try {
        const { branchId, paymentMode, paymentStatus, page = 1, limit = 10 } = req.query;
        const query = {};
        if (branchId) query.branch_id = branchId;
        if (paymentMode) query.payment_mode = paymentMode.toUpperCase();
        if (paymentStatus) query.payment_status = paymentStatus.toUpperCase();

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const [invoices, total] = await Promise.all([
            PharmacyInvoice.find(query)
                .populate('branch_id', 'name code address contact_number')
                .populate('customer_id', 'name phone khata_balance')
                .populate('created_by_user_id', 'full_name role email phone')
                .skip(skip)
                .limit(parseInt(limit, 10))
                .sort({ invoice_date: -1 }),
            PharmacyInvoice.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            data: invoices,
            pagination: helpers.generatePagination(page, limit, total),
        });
    } catch (error) {
        next(error);
    }
};

exports.getPharmacyOrders = async (req, res, next) => {
    try {
        const { paymentStatus, paymentMethod, page = 1, limit = 10 } = req.query;
        const query = {};
        if (paymentStatus) query.paymentStatus = paymentStatus.toLowerCase();
        if (paymentMethod) query.paymentMethod = paymentMethod.toUpperCase();

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const [orders, total] = await Promise.all([
            PharmacyOrder.find(query)
                .populate('patientId', 'firstName lastName email phone')
                .skip(skip)
                .limit(parseInt(limit, 10))
                .sort({ createdAt: -1 }),
            PharmacyOrder.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            data: orders,
            pagination: helpers.generatePagination(page, limit, total),
        });
    } catch (error) {
        next(error);
    }
};

exports.getMRExpenses = async (req, res, next) => {
    try {
        const { approvalStatus, category, mrId, page = 1, limit = 10 } = req.query;
        const query = {};
        if (approvalStatus) query.approvalStatus = approvalStatus.toLowerCase();
        if (category) query.category = category;
        if (mrId) query.mrId = mrId;

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const [expenses, total] = await Promise.all([
            Expense.find(query)
                .populate('mrId', 'firstName lastName email phone')
                .skip(skip)
                .limit(parseInt(limit, 10))
                .sort({ date: -1 }),
            Expense.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            data: expenses,
            pagination: helpers.generatePagination(page, limit, total),
        });
    } catch (error) {
        next(error);
    }
};
