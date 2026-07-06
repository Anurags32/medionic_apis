const User = require('../../../models/User');
const MedicalRep = require('../../../models/MedicalRep');
const ErrorResponse = require('../../../utils/errorResponse');
const { generateToken, generateRefreshToken } = require('../../../middleware/auth');
const constants = require('../../../config/constants');

// @desc    Register MR with file uploads
// @route   POST /api/auth/mr/register
// @access  Public
exports.mrRegister = async (req, res, next) => {
    console.log('\n🧑‍💼  [mrRegister] MR Registration request received');
    try {
        const {
            fullName,
            email,
            password,
            phone,
            companyName,
            employeeId,
            designation,
            territory
        } = req.body;

        console.log(`    Email: ${email} | Name: ${fullName} | Company: ${companyName} | EmpID: ${employeeId}`);

        // Basic validations
        if (!fullName || !email || !password || !phone || !companyName || !employeeId || !designation || !territory) {
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

        // Phone number check (exactly 10 digits)
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

        // Check if employee ID already registered
        console.log(`    🔍  Checking if Employee ID exists: ${employeeId.trim()}`);
        const existingMR = await MedicalRep.findOne({ 'employmentDetails.employeeId': employeeId.trim() });
        if (existingMR) {
            console.warn(`    ⚠️  Employee ID already registered: ${employeeId}`);
            return next(new ErrorResponse('Employee ID already registered', 400));
        }

        // Check for required files (profilePhoto, companyId, govId, authLetter)
        console.log('    📂  Checking uploaded files...');
        if (!req.files || !req.files['profilePhoto'] || !req.files['companyId'] || !req.files['govId'] || !req.files['authLetter']) {
            console.warn('    ⚠️  Missing required files');
            return next(new ErrorResponse('Please upload all required files (Profile Photo, Company ID, Govt ID, Authorization Letter)', 400));
        }
        console.log('    ✅  All required files present');

        // Create User
        console.log('    💾  Creating User record in DB...');
        const user = await User.create({
            email: email.toLowerCase(),
            password,
            role: constants.ROLES.MR,
            status: constants.USER_STATUS.ACTIVE,
            profileComplete: true
        });
        console.log(`    ✅  User created — ID: ${user._id}`);

        // Split fullName into firstName and lastName
        const names = fullName.trim().split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ') || 'Representative';

        // Format phone
        const formattedPhone = `+91${phoneDigits}`;

        // Save file paths
        const profilePicture = `/uploads/${req.files['profilePhoto'][0].filename}`;
        console.log(`    📸  Profile picture: ${profilePicture}`);

        const verificationDocuments = [
            {
                documentType: 'companyId',
                documentUrl: `/uploads/${req.files['companyId'][0].filename}`,
                uploadedAt: new Date()
            },
            {
                documentType: 'govId',
                documentUrl: `/uploads/${req.files['govId'][0].filename}`,
                uploadedAt: new Date()
            },
            {
                documentType: 'authLetter',
                documentUrl: `/uploads/${req.files['authLetter'][0].filename}`,
                uploadedAt: new Date()
            }
        ];
        console.log(`    📋  Verification documents: ${verificationDocuments.map(d => d.documentType).join(', ')}`);

        // Create MR Profile
        console.log('    💾  Creating MedicalRep profile in DB...');
        const medicalRep = await MedicalRep.create({
            userId: user._id,
            firstName,
            lastName,
            companyName: companyName.trim(),
            territory: territory.trim(),
            designation: designation.trim(),
            employmentDetails: {
                joiningDate: new Date(),
                employeeId: employeeId.trim()
            },
            contactDetails: {
                workPhone: formattedPhone,
                workEmail: email.toLowerCase()
            },
            profilePicture,
            verificationDocuments
        });
        console.log(`    ✅  MedicalRep profile created — ID: ${medicalRep._id}`);

        // Generate Tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        console.log(`    🎉  MR registered successfully: ${email}`);

        res.status(201).json({
            success: true,
            message: 'MR registered successfully.',
            data: {
                userId: user._id,
                mrId: medicalRep._id,
                fullName: `${medicalRep.firstName} ${medicalRep.lastName}`,
                email: user.email,
                role: user.role,
                profilePicture: medicalRep.profilePicture
            },
            token,
            refreshToken
        });

    } catch (error) {
        console.error(`    ❌  [mrRegister] Error: ${error.message}`);
        next(error);
    }
};

// @desc    Login MR
// @route   POST /api/auth/mr/login
// @access  Public
exports.mrLogin = async (req, res, next) => {
    console.log('\n🔐  [mrLogin] MR Login request received');
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

        // Validate role is MR
        if (user.role !== constants.ROLES.MR) {
            console.warn(`    ⚠️  Role mismatch: expected 'mr', got '${user.role}'`);
            return next(new ErrorResponse('Invalid credentials for MR login', 401));
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

        // Get MR Profile details
        const medicalRep = await MedicalRep.findOne({ userId: user._id });
        console.log(`    🧑‍💼  MR profile found: ${medicalRep ? medicalRep._id : 'NOT FOUND'}`);

        // Generate Tokens
        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        console.log(`    🎉  MR login successful for: ${email}`);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                userId: user._id,
                mrId: medicalRep ? medicalRep._id : null,
                fullName: medicalRep ? `${medicalRep.firstName} ${medicalRep.lastName}` : 'Medical Representative',
                email: user.email,
                role: user.role,
                profilePicture: medicalRep ? medicalRep.profilePicture : null
            },
            token,
            refreshToken
        });

    } catch (error) {
        console.error(`    ❌  [mrLogin] Error: ${error.message}`);
        next(error);
    }
};
