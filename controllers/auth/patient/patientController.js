const User = require('../../../models/User');
const Patient = require('../../../models/Patient');
const ErrorResponse = require('../../../utils/errorResponse');
const { generateToken, generateRefreshToken } = require('../../../middleware/auth');
const constants = require('../../../config/constants');

// Helper to parse dd/MM/yyyy format or standard ISO Date
const parseDob = (dobStr) => {
    if (!dobStr) return new Date();
    const parts = dobStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    const d = new Date(dobStr);
    return isNaN(d.getTime()) ? new Date() : d;
};

// Helper to parse plain text address into schema-required subdocument
const parseAddress = (addressStr) => {
    let street = 'Default Street';
    let city = 'Default City';
    let state = 'Default State';
    let zip = '110001';

    if (addressStr) {
        const parts = addressStr.split(',').map(p => p.trim());
        if (parts.length >= 4) {
            street = parts.slice(0, parts.length - 3).join(', ');
            city = parts[parts.length - 3];
            state = parts[parts.length - 2];
            zip = parts[parts.length - 1];
        } else if (parts.length === 3) {
            street = parts[0];
            city = parts[1];
            state = parts[2];
        } else if (parts.length === 2) {
            street = parts[0];
            city = parts[1];
        } else if (parts.length === 1) {
            street = parts[0];
        }
    }

    // Ensure ZIP is valid 5 or 6 digits
    const zipDigits = zip.replace(/\D/g, '');
    if (zipDigits.length < 5 || zipDigits.length > 6) {
        zip = '110001';
    } else {
        zip = zipDigits;
    }

    return { street, city, state, zip };
};

// @desc    Register Patient
// @route   POST /api/auth/patient/register
// @access  Public
exports.patientRegister = async (req, res, next) => {
    console.log('\n👤  [patientRegister] Registration request received');
    try {
        const {
            fullName,
            email,
            password,
            phone,
            dob,
            gender,
            address,
            emergencyPhone,
            bloodGroup,
            medicalConditions
        } = req.body;

        console.log(`    Email: ${email} | Name: ${fullName} | Phone: ${phone}`);

        // Basic validations
        if (!fullName || !email || !password || !phone || !dob || !gender || !address || !emergencyPhone) {
            console.warn('    ⚠️  Validation failed: missing required fields');
            return next(new ErrorResponse('Please provide all required fields', 400));
        }

        // Email format validation
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            console.warn(`    ⚠️  Invalid email format: ${email}`);
            return next(new ErrorResponse('Please provide a valid email address', 400));
        }

        // Password requirements validation (min 6 chars, 1 uppercase, 1 number)
        if (password.length < 6 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            console.warn('    ⚠️  Password does not meet requirements');
            return next(new ErrorResponse('Password must be at least 6 characters and contain at least one uppercase letter and one number', 400));
        }

        // Phone number validation (exactly 10 digits)
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length !== 10) {
            console.warn(`    ⚠️  Invalid phone: ${phone} (digits: ${phoneDigits.length})`);
            return next(new ErrorResponse('Mobile number must be exactly 10 digits', 400));
        }

        // Check if user already exists
        console.log(`    🔍  Checking if email already exists: ${email.toLowerCase()}`);
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.warn(`    ⚠️  Email already registered: ${email}`);
            return next(new ErrorResponse('Email already registered', 400));
        }

        // Split fullName on first space
        const trimmedName = fullName.trim();
        const spaceIndex = trimmedName.indexOf(' ');
        let firstName = trimmedName;
        let lastName = '';
        if (spaceIndex !== -1) {
            firstName = trimmedName.substring(0, spaceIndex).trim();
            lastName = trimmedName.substring(spaceIndex + 1).trim();
        }

        // Format phone numbers
        const formattedPhone = phoneDigits; // 10 digits
        const emergDigits = emergencyPhone.replace(/\D/g, '');
        const formattedEmergPhone = emergDigits; // 10 digits

        // Parse optional profile image if uploaded
        let profilePicture;
        if (req.files && req.files['profilePhoto']) {
            profilePicture = `/uploads/${req.files['profilePhoto'][0].filename}`;
            console.log(`    📸  Profile picture: ${profilePicture}`);
        }

        // Create User record
        console.log('    💾  Creating User record in DB...');
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            phone: formattedPhone,
            role: constants.ROLES.PATIENT,
            status: constants.USER_STATUS.ACTIVE,
            profilePhoto: profilePicture,
            profileComplete: true,
            isVerified: false
        });
        console.log(`    ✅  User created — ID: ${user._id}`);

        // Set up medical history if provided
        const medicalHistory = [];
        if (medicalConditions && medicalConditions.trim() && !['none', 'None', 'N/A', 'n/a'].includes(medicalConditions.trim())) {
            medicalHistory.push({
                condition: medicalConditions.trim(),
                diagnosisDate: new Date(),
                status: 'active',
                notes: 'Declared at registration'
            });
        }

        // Parse address
        const parsedAddress = parseAddress(address);

        // Create Patient Profile record
        console.log('    💾  Creating Patient profile in DB...');
        const patient = await Patient.create({
            userId: user._id,
            firstName,
            lastName,
            dob: parseDob(dob),
            gender: gender.toLowerCase(),
            address: parsedAddress,
            rawAddress: address,
            bloodGroup: bloodGroup || 'unknown',
            emergencyContact: {
                name: 'Not Provided',
                phone: formattedEmergPhone,
                relation: 'Contact'
            },
            medicalHistory,
            profilePicture
        });
        console.log(`    ✅  Patient profile created — ID: ${patient._id}`);

        // Generate JWT Tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        console.log(`    🎉  Patient registered successfully: ${email}`);

        res.status(201).json({
            success: true,
            token,
            refreshToken,
            data: {
                userId: user._id,
                patientId: patient._id,
                profileComplete: true,
                role: 'patient',
                fullName: `${patient.firstName} ${patient.lastName}`,
                email: user.email,
                phone: user.phone,
                profilePhoto: patient.profilePicture
            }
        });

    } catch (error) {
        console.error(`    ❌  [patientRegister] Error: ${error.message}`);
        next(error);
    }
};

// @desc    Login Patient
// @route   POST /api/auth/patient/login
// @access  Public
exports.patientLogin = async (req, res, next) => {
    console.log('\n🔐  [patientLogin] Login request received');
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

        // Validate role is patient
        if (user.role !== constants.ROLES.PATIENT) {
            console.warn(`    ⚠️  Role mismatch: expected 'patient', got '${user.role}'`);
            return next(new ErrorResponse('Invalid credentials for patient login', 401));
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

        // Get Patient Profile details
        const patient = await Patient.findOne({ userId: user._id });
        console.log(`    👤  Patient profile found: ${patient ? patient._id : 'NOT FOUND'}`);

        // Generate Tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        console.log(`    🎉  Login successful for: ${email}`);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                userId: user._id,
                patientId: patient ? patient._id : null,
                fullName: patient ? `${patient.firstName} ${patient.lastName}` : 'Patient',
                email: user.email,
                role: user.role,
                profilePicture: patient ? patient.profilePicture : null
            },
            token,
            refreshToken
        });

    } catch (error) {
        console.error(`    ❌  [patientLogin] Error: ${error.message}`);
        next(error);
    }
};
