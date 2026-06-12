const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const MedicalRep = require('../models/MedicalRep');
const ErrorResponse = require('../utils/errorResponse');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = [
    validate('register'),
    async (req, res, next) => {
        try {
            const { email, password, role } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return next(new ErrorResponse('Email already registered', 400));
            }

            // Create user
            const user = await User.create({
                email,
                password,
                role,
                status: constants.USER_STATUS.ACTIVE
            });

            // Generate tokens
            const token = generateToken(user._id);
            const refreshToken = generateRefreshToken(user._id);

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                data: {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    status: user.status
                },
                token,
                refreshToken
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = [
    validate('login'),
    async (req, res, next) => {
        try {
            const { email, password } = req.body;

            // Check if user exists
            const user = await User.findOne({ email });
            if (!user) {
                return next(new ErrorResponse('Invalid credentials', 401));
            }

            // Check if user is active
            if (!user.isActive()) {
                return next(new ErrorResponse('Account is not active', 403));
            }

            // Check password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                return next(new ErrorResponse('Invalid credentials', 401));
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();

            // Generate tokens
            const token = generateToken(user._id);
            const refreshToken = generateRefreshToken(user._id);

            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    profileComplete: user.profileComplete
                },
                token,
                refreshToken
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Complete patient profile
// @route   POST /api/auth/complete-profile/patient
// @access  Private
exports.completePatientProfile = [
    validate('patientProfile'),
    async (req, res, next) => {
        try {
            const user = req.user;

            // Check if user is a patient
            if (user.role !== constants.ROLES.PATIENT) {
                return next(new ErrorResponse('Only patients can complete patient profile', 403));
            }

            // Check if profile already completed
            const existingPatient = await Patient.findOne({ userId: user._id });
            if (existingPatient) {
                return next(new ErrorResponse('Patient profile already completed', 400));
            }

            const {
                firstName,
                lastName,
                dob,
                gender,
                address,
                bloodGroup = 'unknown',
                emergencyContact,
                medicalHistory = [],
                allergies = [],
                insuranceDetails = {}
            } = req.body;

            // Create patient profile
            const patient = await Patient.create({
                userId: user._id,
                firstName,
                lastName,
                dob,
                gender,
                address,
                bloodGroup,
                emergencyContact,
                medicalHistory,
                allergies,
                insuranceDetails
            });

            // Update user profile completion status
            user.profileComplete = true;
            await user.save();

            res.status(201).json({
                success: true,
                message: 'Patient profile completed successfully',
                data: {
                    patientId: patient._id,
                    fullName: patient.fullName,
                    status: 'active'
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Complete doctor profile
// @route   POST /api/auth/complete-profile/doctor
// @access  Private
exports.completeDoctorProfile = [
    validate('doctorProfile'),
    async (req, res, next) => {
        try {
            const user = req.user;

            // Check if user is a doctor
            if (user.role !== constants.ROLES.DOCTOR) {
                return next(new ErrorResponse('Only doctors can complete doctor profile', 403));
            }

            // Check if profile already completed
            const existingDoctor = await Doctor.findOne({ userId: user._id });
            if (existingDoctor) {
                return next(new ErrorResponse('Doctor profile already completed', 400));
            }

            const {
                firstName,
                lastName,
                specialization,
                licenseNumber,
                yearsExperience,
                clinic,
                consultationFee,
                consultationTypes = [constants.CONSULTATION_TYPES.CLINIC],
                bio = '',
                certificates = []
            } = req.body;

            // Check if license number is unique
            const existingLicense = await Doctor.findOne({ licenseNumber });
            if (existingLicense) {
                return next(new ErrorResponse('License number already registered', 400));
            }

            // Create doctor profile
            const doctor = await Doctor.create({
                userId: user._id,
                firstName,
                lastName,
                specialization,
                licenseNumber,
                yearsExperience,
                clinic,
                consultationFee,
                consultationTypes,
                bio,
                certificates,
                verificationStatus: constants.VERIFICATION_STATUS.PENDING
            });

            // Update user profile completion status
            user.profileComplete = true;
            await user.save();

            res.status(201).json({
                success: true,
                message: 'Doctor profile completed successfully',
                data: {
                    doctorId: doctor._id,
                    fullName: doctor.fullName,
                    specialization: doctor.specialization,
                    verificationStatus: doctor.verificationStatus
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Complete MR profile
// @route   POST /api/auth/complete-profile/mr
// @access  Private
exports.completeMRProfile = [
    validate('mrProfile'),
    async (req, res, next) => {
        try {
            const user = req.user;

            // Check if user is an MR
            if (user.role !== constants.ROLES.MR) {
                return next(new ErrorResponse('Only medical representatives can complete MR profile', 403));
            }

            // Check if profile already completed
            const existingMR = await MedicalRep.findOne({ userId: user._id });
            if (existingMR) {
                return next(new ErrorResponse('MR profile already completed', 400));
            }

            const {
                firstName,
                lastName,
                companyName,
                territory,
                designation,
                reportingManager,
                productsHandled = [],
                employmentDetails
            } = req.body;

            // Create MR profile
            const medicalRep = await MedicalRep.create({
                userId: user._id,
                firstName,
                lastName,
                companyName,
                territory,
                designation,
                reportingManager,
                productsHandled,
                employmentDetails: employmentDetails || {
                    joiningDate: new Date(),
                    employeeId: helpers.generateRandomString(8),
                    department: 'Sales'
                }
            });

            // Update user profile completion status
            user.profileComplete = true;
            await user.save();

            res.status(201).json({
                success: true,
                message: 'MR profile completed successfully',
                data: {
                    mrId: medicalRep._id,
                    fullName: medicalRep.fullName,
                    companyName: medicalRep.companyName,
                    territory: medicalRep.territory
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return next(new ErrorResponse('Refresh token required', 400));
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || constants.JWT_SECRET);

        // Check if user exists
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        // Generate new access token
        const newAccessToken = generateToken(user._id);

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: newAccessToken
            }
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return next(new ErrorResponse('Invalid or expired refresh token', 401));
        }
        next(error);
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
    try {
        // In a real application, you might want to:
        // 1. Add token to blacklist
        // 2. Clear cookies
        // 3. Update user session

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = [
    validate('forgotPassword'),
    async (req, res, next) => {
        try {
            const { email } = req.body;

            // Check if user exists
            const user = await User.findOne({ email });
            if (!user) {
                // Don't reveal that user doesn't exist (security best practice)
                return res.status(200).json({
                    success: true,
                    message: 'If your email is registered, you will receive a password reset link'
                });
            }

            // Generate reset token
            const resetToken = user.getResetPasswordToken();
            await user.save();

            // In production, send email with reset link
            // For now, we'll return the token (in production, this should be sent via email)
            const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

            // Log the reset URL (in development only)
            if (process.env.NODE_ENV === 'development') {
                console.log('Password reset URL:', resetUrl);
            }

            res.status(200).json({
                success: true,
                message: 'Password reset instructions sent to email',
                data: {
                    // In production, don't return the token in response
                    resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = [
    validate('resetPassword'),
    async (req, res, next) => {
        try {
            const { resetToken, newPassword } = req.body;

            // Find user by reset token and check expiry
            const user = await User.findOne({
                resetPasswordToken: resetToken,
                resetPasswordExpire: { $gt: Date.now() }
            });

            if (!user) {
                return next(new ErrorResponse('Invalid or expired reset token', 400));
            }

            // Update password
            user.password = newPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();

            res.status(200).json({
                success: true,
                message: 'Password reset successful'
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = req.user;

        // Get profile based on role
        let profile = null;
        let profileData = null;

        switch (user.role) {
            case constants.ROLES.PATIENT:
                profile = await Patient.findOne({ userId: user._id });
                if (profile) {
                    profileData = {
                        ...profile.toObject(),
                        age: helpers.calculateAge(profile.dob)
                    };
                }
                break;

            case constants.ROLES.DOCTOR:
                profile = await Doctor.findOne({ userId: user._id });
                if (profile) {
                    profileData = {
                        ...profile.toObject(),
                        experience: profile.experience
                    };
                }
                break;

            case constants.ROLES.MR:
                profile = await MedicalRep.findOne({ userId: user._id });
                if (profile) {
                    profileData = {
                        ...profile.toObject(),
                        tenure: profile.tenure,
                        achievementPercentage: profile.achievementPercentage
                    };
                }
                break;

            case constants.ROLES.ADMIN:
                profileData = {
                    role: 'admin',
                    permissions: ['all']
                };
                break;
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                    status: user.status,
                    profileComplete: user.profileComplete,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt
                },
                profile: profileData
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
exports.updateMe = async (req, res, next) => {
    try {
        const user = req.user;
        const { email, currentPassword, newPassword } = req.body;

        // Update email if provided
        if (email && email !== user.email) {
            // Check if email is already taken
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return next(new ErrorResponse('Email already registered', 400));
            }
            user.email = email;
        }

        // Update password if provided
        if (currentPassword && newPassword) {
            // Verify current password
            const isPasswordValid = await user.comparePassword(currentPassword);
            if (!isPasswordValid) {
                return next(new ErrorResponse('Current password is incorrect', 400));
            }

            // Validate new password
            const validators = require('../utils/validators');
            if (!validators.isValidPassword(newPassword)) {
                return next(new ErrorResponse('New password does not meet requirements', 400));
            }

            user.password = newPassword;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                    status: user.status
                }
            }
        });
    } catch (error) {
        next(error);
    }
};