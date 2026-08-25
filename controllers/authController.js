const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const MedicalRep = require('../models/MedicalRep');
const ErrorResponse = require('../utils/errorResponse');
const TokenBlacklist = require('../models/TokenBlacklist');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');
const jwt = require('jsonwebtoken');

exports.register = [
    validate('register'),
    async (req, res, next) => {
        try {
            const { email, password, role } = req.body;

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return next(new ErrorResponse('Email already registered', 400));
            }

            const user = await User.create({
                email,
                password,
                role,
                status: constants.USER_STATUS.ACTIVE
            });

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

exports.login = [
    validate('login'),
    async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });
            if (!user) {
                return next(new ErrorResponse('Invalid credentials', 401));
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


exports.completePatientProfile = [
    validate('patientProfile'),
    async (req, res, next) => {
        try {
            const user = req.user;
            if (user.role !== constants.ROLES.PATIENT) {
                return next(new ErrorResponse('Only patients can complete patient profile', 403));
            }
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

            let fName = firstName;
            let lName = lastName;
            if (req.body.fullName) {
                const names = helpers.parseFullName(req.body.fullName);
                fName = names.firstName;
                lName = names.lastName;
            }

            const parsedDob = helpers.normalizeDob(dob);
            const parsedAddress = helpers.parseAddress(address);

            let parsedEmergencyContact = emergencyContact;
            if (typeof emergencyContact === 'string') {
                parsedEmergencyContact = {
                    name: 'Emergency Contact',
                    phone: emergencyContact,
                    relation: 'Contact'
                };
            } else if (emergencyContact) {
                parsedEmergencyContact = {
                    name: emergencyContact.name || 'Emergency Contact',
                    phone: emergencyContact.phone || req.body.emergencyPhone || '9999999999',
                    relation: emergencyContact.relation || 'Contact'
                };
            } else if (req.body.emergencyPhone) {
                parsedEmergencyContact = {
                    name: 'Emergency Contact',
                    phone: req.body.emergencyPhone,
                    relation: 'Contact'
                };
            } else {
                parsedEmergencyContact = {
                    name: 'Emergency Contact',
                    phone: '9999999999',
                    relation: 'Contact'
                };
            }
            const parsedMedicalHistory = helpers.normalizeMedicalHistory(req.body.medicalConditions || medicalHistory);
            const patient = await Patient.create({
                userId: user._id,
                firstName: fName,
                lastName: lName,
                dob: parsedDob,
                gender,
                address: parsedAddress,
                bloodGroup,
                emergencyContact: parsedEmergencyContact,
                medicalHistory: parsedMedicalHistory,
                allergies,
                insuranceDetails
            });
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

exports.completeDoctorProfile = [
    validate('doctorProfile'),
    async (req, res, next) => {
        try {
            const user = req.user;
            if (user.role !== constants.ROLES.DOCTOR) {
                return next(new ErrorResponse('Only doctors can complete doctor profile', 403));
            }
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
                consultationTypes = Object.values(constants.CONSULTATION_TYPES),
                bio = '',
                certificates = []
            } = req.body;

            let fName = firstName;
            let lName = lastName;
            if (req.body.fullName) {
                const names = helpers.parseFullName(req.body.fullName);
                fName = names.firstName;
                lName = names.lastName;
            }

            let parsedClinic = clinic;
            if (typeof clinic === 'string') {
                parsedClinic = {
                    name: 'Doctor Clinic',
                    address: clinic,
                    city: 'Default City',
                    phone: '+919999999999'
                };
            }
            const existingLicense = await Doctor.findOne({ licenseNumber });
            if (existingLicense) {
                return next(new ErrorResponse('License number already registered', 400));
            }
            const doctor = await Doctor.create({
                userId: user._id,
                firstName: fName,
                lastName: lName,
                specialization,
                licenseNumber,
                yearsExperience,
                clinic: parsedClinic,
                consultationFee,
                consultationTypes,
                bio,
                certificates,
                schedule: req.body.schedule || {},
                slotDurationMinutes: req.body.slotDurationMinutes || 30,
                verificationStatus: constants.VERIFICATION_STATUS.PENDING
            });
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

exports.completeMRProfile = [
    validate('mrProfile'),
    async (req, res, next) => {
        try {
            const user = req.user;
            if (user.role !== constants.ROLES.MR) {
                return next(new ErrorResponse('Only medical representatives can complete MR profile', 403));
            }
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

            let fName = firstName;
            let lName = lastName;
            if (req.body.fullName) {
                const names = helpers.parseFullName(req.body.fullName);
                fName = names.firstName;
                lName = names.lastName;
            }

            const medicalRep = await MedicalRep.create({
                userId: user._id,
                firstName: fName,
                lastName: lName,
                phone: req.body.phone || '+919999999999',
                companyName,
                territory,
                designation,
                reportingManager,
                productsHandled,
                employmentDetails: employmentDetails || {
                    joiningDate: new Date(),
                    employeeId: req.body.employeeId || helpers.generateRandomString(8),
                    department: 'Sales'
                }
            });

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

exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return next(new ErrorResponse('Refresh token required', 400));
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || constants.JWT_SECRET);

        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

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

exports.logout = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (token) {
            const decoded = jwt.decode(token);
            const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

            const isBlacklisted = await TokenBlacklist.findOne({ token });
            if (!isBlacklisted) {
                await TokenBlacklist.create({ token, expiresAt });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};

exports.forgotPassword = [
    validate('forgotPassword'),
    async (req, res, next) => {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return res.status(200).json({
                    success: true,
                    message: 'If your email is registered, you will receive a password reset link'
                });
            }

            const resetToken = user.getResetPasswordToken();
            await user.save();
            const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
            if (process.env.NODE_ENV === 'development') {
                console.log('Password reset URL:', resetUrl);
            }

            res.status(200).json({
                success: true,
                message: 'Password reset instructions sent to email',
                data: {
                    resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

exports.resetPassword = [
    validate('resetPassword'),
    async (req, res, next) => {
        try {
            const { resetToken, newPassword } = req.body;

            const user = await User.findOne({
                resetPasswordToken: resetToken,
                resetPasswordExpire: { $gt: Date.now() }
            });

            if (!user) {
                return next(new ErrorResponse('Invalid or expired reset token', 400));
            }
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

exports.getMe = async (req, res, next) => {
    try {
        const user = req.user;

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
exports.updateMe = async (req, res, next) => {
    try {
        const user = req.user;
        const { email, currentPassword, newPassword } = req.body;

        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return next(new ErrorResponse('Email already registered', 400));
            }
            user.email = email;
        }

        if (currentPassword && newPassword) {
            const isPasswordValid = await user.comparePassword(currentPassword);
            if (!isPasswordValid) {
                return next(new ErrorResponse('Current password is incorrect', 400));
            }

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