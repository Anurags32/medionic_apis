const User = require('../../../models/User');
const Doctor = require('../../../models/Doctor');
const ErrorResponse = require('../../../utils/errorResponse');
const { generateToken, generateRefreshToken } = require('../../../middleware/auth');
const constants = require('../../../config/constants');

// @desc    Register Doctor with document uploads
// @route   POST /api/auth/doctor/register
// @access  Public
exports.doctorRegister = async (req, res, next) => {
    console.log('\n👨‍⚕️  [doctorRegister] Doctor Registration request received');
    try {
        const {
            fullName,
            email,
            password,
            phone,
            licenseNumber,
            registrationCouncil,
            qualification,
            specialization,
            yearsExperience,
            clinicName,
            clinicAddress,
            city,
            consultationFee
        } = req.body;

        console.log(`    Email: ${email} | Name: ${fullName} | License: ${licenseNumber} | Specialization: ${specialization}`);

        // Basic validations
        if (!fullName || !email || !password || !phone || !licenseNumber || !registrationCouncil || !qualification || !specialization || !yearsExperience || !clinicName || !clinicAddress) {
            console.warn('    ⚠️  Validation failed: missing required fields');
            return next(new ErrorResponse('Please provide all required fields', 400));
        }

        // Email format check
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            console.warn(`    ⚠️  Invalid email format: ${email}`);
            return next(new ErrorResponse('Please provide a valid email address', 400));
        }

        // Password requirements check (min 6 chars, 1 uppercase, 1 number)
        if (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            console.warn('    ⚠️  Password does not meet requirements');
            return next(new ErrorResponse('Password must be at least 6 characters and contain at least one uppercase letter and one number', 400));
        }

        // Mobile number check (exactly 10 digits)
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
            console.warn(`    ⚠️  Invalid phone: ${phone} (digits: ${phoneDigits.length})`);
            return next(new ErrorResponse('Mobile number must be exactly 10 digits', 400));
        }

        // Check if user already exists
        console.log(`    🔍  Checking if email exists: ${email.toLowerCase()}`);
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.warn(`    ⚠️  Email already registered: ${email}`);
            return next(new ErrorResponse('Email already registered', 400));
        }

        // Check if license number already exists
        console.log(`    🔍  Checking if license number exists: ${licenseNumber.trim()}`);
        const existingLicense = await Doctor.findOne({ licenseNumber: licenseNumber.trim() });
        if (existingLicense) {
            console.warn(`    ⚠️  License number already registered: ${licenseNumber}`);
            return next(new ErrorResponse('Medical Registration / License number already registered', 400));
        }

        // Check for required files
        console.log('    📂  Checking uploaded files...');
        if (!req.files || !req.files['profilePhoto'] || !req.files['govId'] || !req.files['degree'] || !req.files['councilId']) {
            console.warn('    ⚠️  Missing required files');
            return next(new ErrorResponse('Please upload all required files (Profile Photo, Govt ID, Degree Certificate, Council ID)', 400));
        }
        console.log('    ✅  All required files present');

        // Split fullName into firstName and lastName on first space
        const trimmedName = fullName.trim();
        const spaceIndex = trimmedName.indexOf(' ');
        let firstName = trimmedName;
        let lastName = '';
        if (spaceIndex !== -1) {
            firstName = trimmedName.substring(0, spaceIndex).trim();
            lastName = trimmedName.substring(spaceIndex + 1).trim();
        }

        // Prepare uploaded files paths
        const profilePicture = `/uploads/${req.files['profilePhoto'][0].filename}`;
        console.log(`    📸  Profile picture: ${profilePicture}`);

        // Create User
        console.log('    💾  Creating User record in DB...');
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            phone: phoneDigits,
            role: constants.ROLES.DOCTOR,
            status: constants.USER_STATUS.ACTIVE,
            profilePhoto: profilePicture,
            profileComplete: true,
            isVerified: false
        });
        console.log(`    ✅  User created — ID: ${user._id}`);

        const verificationDocuments = [
            {
                documentType: 'govId',
                documentUrl: `/uploads/${req.files['govId'][0].filename}`,
                uploadedAt: new Date()
            },
            {
                documentType: 'degree',
                documentUrl: `/uploads/${req.files['degree'][0].filename}`,
                uploadedAt: new Date()
            },
            {
                documentType: 'councilId',
                documentUrl: `/uploads/${req.files['councilId'][0].filename}`,
                uploadedAt: new Date()
            }
        ];
        console.log(`    📋  Verification documents: ${verificationDocuments.map(d => d.documentType).join(', ')}`);

        // Format phone to match regex in schema if needed (+91 prefix or raw 10 digit)
        const formattedPhone = `+91${phoneDigits}`;

        // Best effort city extraction from clinicAddress
        let extractedCity = '';
        if (city && city.trim()) {
            extractedCity = city.trim();
        } else if (clinicAddress && clinicAddress.includes(',')) {
            const segments = clinicAddress.split(',');
            extractedCity = segments[segments.length - 1].trim();
        }

        // Create Doctor Profile
        console.log('    💾  Creating Doctor profile in DB...');
        const doctor = await Doctor.create({
            userId: user._id,
            firstName,
            lastName,
            specialization: specialization.trim(),
            licenseNumber: licenseNumber.trim(),
            yearsExperience: parseInt(yearsExperience) || 0,
            clinic: {
                name: clinicName.trim(),
                address: clinicAddress.trim(),
                city: extractedCity,
                phone: formattedPhone
            },
            consultationFee: parseInt(consultationFee) || 500,
            verificationStatus: constants.VERIFICATION_STATUS.PENDING,
            verificationDocuments,
            profilePicture,
            languages: ['English', 'Hindi'],
            education: [{
                degree: qualification.trim(),
                institution: 'Medical Council of India recognized institution',
                year: new Date().getFullYear() - (parseInt(yearsExperience) || 0)
            }]
        });
        console.log(`    ✅  Doctor profile created — ID: ${doctor._id} | Status: ${doctor.verificationStatus}`);

        // Generate Tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        console.log(`    🎉  Doctor registered successfully: ${email} (pending verification)`);

        res.status(201).json({
            success: true,
            token,
            refreshToken,
            data: {
                userId: user._id,
                doctorId: doctor._id,
                profileComplete: true,
                role: 'doctor',
                fullName: `${doctor.firstName} ${doctor.lastName}`,
                email: user.email,
                phone: user.phone,
                verificationStatus: doctor.verificationStatus,
                profilePhoto: doctor.profilePicture
            }
        });

    } catch (error) {
        console.error(`    ❌  [doctorRegister] Error: ${error.message}`);
        next(error);
    }
};

// @desc    Login Doctor
// @route   POST /api/auth/doctor/login
// @access  Public
exports.doctorLogin = async (req, res, next) => {
    console.log('\n🔐  [doctorLogin] Doctor Login request received');
    try {
        const { email, password } = req.body;
        console.log(`    Email: ${email}`);

        if (!email || !password) {
            console.warn('    ⚠️  Missing email or password');
            return next(new ErrorResponse('Please provide email and password', 400));
        }

        // Find user
        console.log(`    🔍  Looking up user by email: ${email.toLowerCase()}`);
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.warn(`    ⚠️  No user found with email: ${email}`);
            return next(new ErrorResponse('Invalid credentials', 401));
        }
        console.log(`    ✅  User found — ID: ${user._id} | Role: ${user.role}`);

        // Validate role is doctor
        if (user.role !== constants.ROLES.DOCTOR) {
            console.warn(`    ⚠️  Role mismatch: expected 'doctor', got '${user.role}'`);
            return next(new ErrorResponse('Invalid credentials for doctor login', 401));
        }

        // Check if active
        if (!user.isActive()) {
            console.warn(`    ⚠️  Account inactive or suspended: ${email}`);
            return next(new ErrorResponse('Account is suspended or inactive', 403));
        }

        // Compare password
        console.log('    🔑  Comparing password...');
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.warn(`    ⚠️  Password mismatch for: ${email}`);
            return next(new ErrorResponse('Invalid credentials', 401));
        }
        console.log('    ✅  Password matched');

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Get Doctor details
        const doctor = await Doctor.findOne({ userId: user._id });
        console.log(`    👨‍⚕️  Doctor profile found: ${doctor ? doctor._id : 'NOT FOUND'}`);

        // Generate Tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        console.log(`    🎉  Doctor login successful for: ${email}`);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                userId: user._id,
                doctorId: doctor ? doctor._id : null,
                fullName: doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Doctor',
                email: user.email,
                role: user.role,
                verificationStatus: doctor ? doctor.verificationStatus : 'unknown',
                profilePicture: doctor ? doctor.profilePicture : null
            },
            token,
            refreshToken
        });

    } catch (error) {
        console.error(`    ❌  [doctorLogin] Error: ${error.message}`);
        next(error);
    }
};

// @desc    Get logged in doctor profile
// @route   GET /api/auth/doctor/profile
// @access  Private/Doctor
exports.getDoctorProfile = async (req, res, next) => {
    console.log(`\n👨‍⚕️  [getDoctorProfile] Requested by user: ${req.user._id}`);
    try {
        const doctor = await Doctor.findOne({ userId: req.user._id }).populate('userId', 'email role lastLogin');
        if (!doctor) {
            console.warn(`    ⚠️  Doctor profile not found for user: ${req.user._id}`);
            return next(new ErrorResponse('Doctor profile not found', 404));
        }
        console.log(`    ✅  Doctor profile fetched — ID: ${doctor._id}`);

        res.status(200).json({
            success: true,
            data: doctor
        });
    } catch (error) {
        console.error(`    ❌  [getDoctorProfile] Error: ${error.message}`);
        next(error);
    }
};

// @desc    Update Doctor profile details
// @route   PUT /api/auth/doctor/profile
// @access  Private/Doctor
exports.updateDoctorProfile = async (req, res, next) => {
    console.log(`\n✏️   [updateDoctorProfile] Update request by user: ${req.user._id}`);
    try {
        const doctor = await Doctor.findOne({ userId: req.user._id });
        if (!doctor) {
            console.warn(`    ⚠️  Doctor profile not found for user: ${req.user._id}`);
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const {
            fullName,
            specialization,
            yearsExperience,
            clinicName,
            clinicAddress,
            city,
            phone,
            bio
        } = req.body;

        // Update name if passed
        if (fullName) {
            const names = fullName.trim().split(' ');
            doctor.firstName = names[0];
            doctor.lastName = names.slice(1).join(' ') || '';
            console.log(`    📝  Name updated to: ${doctor.firstName} ${doctor.lastName}`);
        }

        // Update basic professional details
        if (specialization) { doctor.specialization = specialization.trim(); console.log(`    📝  Specialization: ${specialization}`); }
        if (yearsExperience) { doctor.yearsExperience = parseInt(yearsExperience) || doctor.yearsExperience; console.log(`    📝  Experience: ${yearsExperience} years`); }
        if (bio) { doctor.bio = bio.trim(); console.log(`    📝  Bio updated`); }

        // Update clinic details
        if (clinicName) doctor.clinic.name = clinicName.trim();
        if (clinicAddress) doctor.clinic.address = clinicAddress.trim();
        if (city) doctor.clinic.city = city.trim();
        if (phone) {
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) {
                doctor.clinic.phone = `+91${digits}`;
                console.log(`    📝  Clinic phone updated: +91${digits}`);
            }
        }

        // Update profile picture if uploaded
        if (req.files && req.files['profilePhoto']) {
            doctor.profilePicture = `/uploads/${req.files['profilePhoto'][0].filename}`;
            console.log(`    📸  Profile picture updated: ${doctor.profilePicture}`);
        }

        await doctor.save();
        console.log(`    ✅  Doctor profile saved — ID: ${doctor._id}`);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: doctor
        });

    } catch (error) {
        console.error(`    ❌  [updateDoctorProfile] Error: ${error.message}`);
        next(error);
    }
};

// @desc    Get current doctor verification status
// @route   GET /api/auth/doctor/status
// @access  Private/Doctor
exports.getVerificationStatus = async (req, res, next) => {
    console.log(`\n🔎  [getVerificationStatus] Requested by user: ${req.user._id}`);
    try {
        const doctor = await Doctor.findOne({ userId: req.user._id });
        if (!doctor) {
            console.warn(`    ⚠️  Doctor profile not found for user: ${req.user._id}`);
            return next(new ErrorResponse('Doctor profile not found', 404));
        }
        console.log(`    ✅  Verification status: ${doctor.verificationStatus}`);

        res.status(200).json({
            success: true,
            data: {
                verificationStatus: doctor.verificationStatus
            }
        });
    } catch (error) {
        console.error(`    ❌  [getVerificationStatus] Error: ${error.message}`);
        next(error);
    }
};

// @desc    Admin-side update doctor verification status
// @route   PUT /api/auth/doctor/status
// @access  Private/Admin
exports.updateVerificationStatusAdmin = async (req, res, next) => {
    console.log(`\n🛡️   [updateVerificationStatusAdmin] Admin update request`);
    try {
        const { doctorId, status } = req.body;
        console.log(`    DoctorID: ${doctorId} | New Status: ${status}`);

        if (!doctorId || !status) {
            console.warn('    ⚠️  Missing doctorId or status');
            return next(new ErrorResponse('Please provide doctorId and verification status', 400));
        }

        // Validate status type
        if (!Object.values(constants.VERIFICATION_STATUS).includes(status)) {
            console.warn(`    ⚠️  Invalid status value: ${status}`);
            return next(new ErrorResponse('Invalid status value. Must be pending, verified, or rejected.', 400));
        }

        console.log(`    🔍  Looking up doctor by ID: ${doctorId}`);
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            console.warn(`    ⚠️  Doctor not found: ${doctorId}`);
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const oldStatus = doctor.verificationStatus;
        doctor.verificationStatus = status;
        await doctor.save();
        console.log(`    ✅  Status updated: ${oldStatus} → ${status} for Doctor: ${doctor._id}`);

        res.status(200).json({
            success: true,
            message: `Doctor verification status updated to ${status} successfully.`,
            data: {
                doctorId: doctor._id,
                fullName: `${doctor.firstName} ${doctor.lastName}`,
                verificationStatus: doctor.verificationStatus
            }
        });

    } catch (error) {
        console.error(`    ❌  [updateVerificationStatusAdmin] Error: ${error.message}`);
        next(error);
    }
};
