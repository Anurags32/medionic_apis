const bcrypt = require('bcryptjs');
const { User, Branch, OTP } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../config/pharmacyJwt');
const { ROLES, DEFAULT_ROLE_PERMISSIONS } = require('../../config/pharmacyConstants');


const registerOwner = async (payload) => {
    const {
        branch_details,
        full_name,
        email,
        phone,
        password,
        pharmacist_reg_no,
    } = payload;

    if (!branch_details || !branch_details.name || !branch_details.drug_license_no || !branch_details.gstin) {
        throw new ApiError(
            400,
            'Branch details (name, drug_license_no, gstin, contact_number, address) are required',
            'BRANCH_DETAILS_REQUIRED'
        );
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
        throw new ApiError(409, 'Email is already registered', 'EMAIL_EXISTS');
    }

    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) {
        throw new ApiError(409, 'Phone number is already registered', 'PHONE_EXISTS');
    }

    const branchCode = branch_details.code || 'MED-' + Math.floor(1000 + Math.random() * 9000);

    const newBranch = await Branch.create({
        name: branch_details.name,
        code: branchCode,
        drug_license_no: branch_details.drug_license_no,
        gstin: branch_details.gstin,
        address: branch_details.address || '',
        contact_number: branch_details.contact_number || phone,
        email: branch_details.email || email,
        // Free 14-day trial, no card required.
        subscription: Branch.trialSubscription(),
    });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newOwner = await User.create({
        branch_id: newBranch._id,
        full_name,
        email: email.toLowerCase(),
        phone: phone.trim(),
        password_hash,
        role: ROLES.PHARMACY_OWNER,
        pharmacist_reg_no: pharmacist_reg_no || null,
        features_granted: DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACY_OWNER],
        token_version: 0,
        is_active: false,          // Blocked until admin approves
        approval_status: 'pending', // Must be approved by admin
        is_blocked: false,
    });

    newBranch.owner_id = newOwner._id;
    await newBranch.save();

    // Do NOT issue tokens — owner must be approved by admin first
    return {
        message: 'Registration successful. Your account is pending admin approval. You will be able to login once approved.',
        approval_status: 'pending',
        user: {
            id: newOwner._id.toString(),
            full_name: newOwner.full_name,
            email: newOwner.email,
            phone: newOwner.phone,
            role: newOwner.role,
            approval_status: newOwner.approval_status,
            branch: {
                id: newBranch._id.toString(),
                name: newBranch.name,
                code: newBranch.code,
                drug_license_no: newBranch.drug_license_no,
                gstin: newBranch.gstin,
                is_available: newBranch.is_available,
            },
        },
    };
};

const loginUser = async (email, password) => {
    const user = await User.findOne({ email: email.toLowerCase() }).populate('branch');

    if (!user) {
        throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.lock_until && user.lock_until > new Date()) {
        const minutesLeft = Math.ceil((user.lock_until.getTime() - Date.now()) / (60 * 1000));
        throw new ApiError(
            423,
            `Account is temporarily locked due to repeated failed login attempts. Please try again after ${minutesLeft} minute(s).`,
            'ACCOUNT_LOCKED'
        );
    }

    if (user.is_blocked) {
        throw new ApiError(
            403,
            user.block_reason
                ? `Account is blocked: ${user.block_reason}`
                : 'Your account has been blocked. Contact administrator.',
            'ACCOUNT_BLOCKED'
        );
    }

    if (user.role === ROLES.PHARMACY_OWNER && user.approval_status !== 'approved') {
        if (user.approval_status === 'rejected') {
            throw new ApiError(
                403,
                user.approval_remarks
                    ? `Your registration was rejected: ${user.approval_remarks}`
                    : 'Your registration was rejected by administrator.',
                'ACCOUNT_REJECTED'
            );
        }
        throw new ApiError(
            403,
            'Your account is pending admin approval. Please wait for admin to approve your account.',
            'ACCOUNT_PENDING_APPROVAL'
        );
    }

    if (!user.is_active) {
        throw new ApiError(
            403,
            'Your account is deactivated. Please contact your administrator.',
            'ACCOUNT_DEACTIVATED'
        );
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordCorrect) {
        user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;
        if (user.failed_login_attempts >= 5) {
            user.lock_until = new Date(Date.now() + 15 * 60 * 1000);
        }
        await user.save();
        throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Reset failed login attempts on successful login
    user.failed_login_attempts = 0;
    user.lock_until = null;

    const livePermissions = user.role === ROLES.PHARMACY_OWNER
        ? DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACY_OWNER]
        : (user.features_granted || DEFAULT_ROLE_PERMISSIONS[user.role] || []);

    const tokenPayload = {
        userId: user._id.toString(),
        branchId: user.branch_id.toString(),
        role: user.role,
        features: livePermissions,
        tokenVersion: user.token_version,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user._id.toString(), tokenVersion: user.token_version });

    user.last_login_at = new Date();
    await user.save();

    const branch = user.branch || await Branch.findById(user.branch_id);

    const userSafe = {
        id: user._id.toString(),
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        features_granted: livePermissions,
        mustChangePassword: Boolean(user.must_change_password),
        must_change_password: Boolean(user.must_change_password),
        duty_status: user.duty_status || 'OFF_DUTY',
        current_location: user.current_location,
        branch_id: user.branch_id.toString(),
        branch: branch
            ? {
                  id: branch._id.toString(),
                  name: branch.name,
                  code: branch.code,
                  gstin: branch.gstin,
                  drug_license_no: branch.drug_license_no,
                  is_available: branch.is_available,
                  subscription: branch.getSubscriptionDetails ? branch.getSubscriptionDetails() : null,
              }
            : null,
    };

    return { user: userSafe, accessToken, refreshToken };
};

const logoutUser = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    user.token_version = (user.token_version || 0) + 1;
    user.is_online = false;
    await user.save();

    return { message: 'Logged out successfully' };
};

const refreshToken = async (incomingRefreshToken) => {
    let decoded;
    try {
        decoded = verifyRefreshToken(incomingRefreshToken);
    } catch (err) {
        throw new ApiError(401, 'Invalid or expired refresh token', 'REFRESH_TOKEN_INVALID');
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.is_blocked || !user.is_active) {
        throw new ApiError(403, 'User account is invalid, blocked, or deactivated', 'ACCOUNT_RESTRICTED');
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.token_version) {
        throw new ApiError(401, 'Refresh token has been invalidated. Please log in again.', 'SESSION_INVALIDATED');
    }

    const livePermissions = user.role === ROLES.PHARMACY_OWNER
        ? DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACY_OWNER]
        : (user.features_granted || DEFAULT_ROLE_PERMISSIONS[user.role] || []);

    const tokenPayload = {
        userId: user._id.toString(),
        branchId: user.branch_id.toString(),
        role: user.role,
        features: livePermissions,
        tokenVersion: user.token_version,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken({ userId: user._id.toString(), tokenVersion: user.token_version });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

const sendOtp = async (phone, purpose = 'LOGIN') => {
    if (!phone) {
        throw new ApiError(400, 'Phone number is required', 'PHONE_REQUIRED');
    }

    await OTP.updateMany({ phone: phone.trim(), is_used: false }, { is_used: true });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTP.create({
        phone: phone.trim(),
        otp_code: otpCode,
        expires_at: expiresAt,
        is_used: false,
        attempts: 0,
        purpose,
    });

    return {
        phone,
        message: 'OTP sent successfully',
        expiresInSeconds: 300,
        demoOtp: (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') ? otpCode : undefined,
    };
};

const verifyOtp = async (phone, otpCode) => {
    if (!phone || !otpCode) {
        throw new ApiError(400, 'Phone and OTP code are required', 'PARAMS_REQUIRED');
    }

    const otpRecord = await OTP.findOne({
        phone: phone.trim(),
        is_used: false,
        expires_at: { $gt: new Date() },
    }).sort({ created_at: -1 });

    if (!otpRecord) {
        throw new ApiError(400, 'Invalid, expired, or already used OTP', 'OTP_INVALID');
    }

    if (otpRecord.attempts >= 5) {
        otpRecord.is_used = true;
        await otpRecord.save();
        throw new ApiError(429, 'Too many incorrect attempts. Please request a new OTP.', 'OTP_MAX_ATTEMPTS');
    }

    if (otpRecord.otp_code !== otpCode.trim()) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        throw new ApiError(400, 'Incorrect OTP code entered', 'OTP_INCORRECT');
    }

    otpRecord.is_used = true;
    await otpRecord.save();

    const user = await User.findOne({ phone: phone.trim() }).populate('branch');

    if (!user) {
        return {
            verified: true,
            isRegistered: false,
            phone,
            message: 'Phone verified successfully',
        };
    }

    if (user.is_blocked) {
        throw new ApiError(403, 'Account is blocked by administrator', 'ACCOUNT_BLOCKED');
    }

    if (user.role === ROLES.PHARMACY_OWNER && user.approval_status !== 'approved') {
        if (user.approval_status === 'rejected') {
            throw new ApiError(
                403,
                user.approval_remarks
                    ? `Your registration was rejected: ${user.approval_remarks}`
                    : 'Your registration was rejected by administrator.',
                'ACCOUNT_REJECTED'
            );
        }
        throw new ApiError(
            403,
            'Your account is pending admin approval. Please wait for admin to approve your account.',
            'ACCOUNT_PENDING_APPROVAL'
        );
    }

    if (!user.is_active) {
        throw new ApiError(403, 'Account is deactivated', 'ACCOUNT_INACTIVE');
    }

    const livePermissions = user.role === ROLES.PHARMACY_OWNER
        ? DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACY_OWNER]
        : (user.features_granted || DEFAULT_ROLE_PERMISSIONS[user.role] || []);

    const tokenPayload = {
        userId: user._id.toString(),
        branchId: user.branch_id.toString(),
        role: user.role,
        features: livePermissions,
        tokenVersion: user.token_version,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ userId: user._id.toString(), tokenVersion: user.token_version });

    user.last_login_at = new Date();
    await user.save();

    return {
        verified: true,
        isRegistered: true,
        user,
        accessToken,
        refreshToken,
        message: 'OTP verified successfully',
    };
};

const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
        throw new ApiError(400, 'Incorrect current password', 'CURRENT_PASSWORD_INCORRECT');
    }

    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    user.must_change_password = false;
    user.token_version = (user.token_version || 0) + 1;
    await user.save();

    return { message: 'Password updated successfully' };
};

const getProfile = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }

    const branch = user.branch_id ? await Branch.findById(user.branch_id) : null;
    const subscription = branch ? branch.getSubscriptionDetails() : null;

    const livePermissions = user.role === ROLES.PHARMACY_OWNER
        ? DEFAULT_ROLE_PERMISSIONS[ROLES.PHARMACY_OWNER]
        : (user.features_granted || DEFAULT_ROLE_PERMISSIONS[user.role] || []);

    const branchData = branch
        ? {
              id: branch._id.toString(),
              name: branch.name,
              code: branch.code,
              gstin: branch.gstin,
              drug_license_no: branch.drug_license_no,
              address: branch.address,
              pincode: branch.pincode,
              is_available: branch.is_available,
              subscription,
          }
        : null;

    const userSafe = {
        id: user._id.toString(),
        userId: user._id.toString(),
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        features_granted: livePermissions,
        mustChangePassword: Boolean(user.must_change_password),
        must_change_password: Boolean(user.must_change_password),
        duty_status: user.duty_status || 'OFF_DUTY',
        battery_level: user.battery_level !== undefined && user.battery_level !== null ? user.battery_level : null,
        active_counter: user.active_counter || null,
        current_location: user.current_location,
        branch_id: user.branch_id ? user.branch_id.toString() : null,
        branch: branchData,
        branchId: user.branch_id ? user.branch_id.toString() : null,
    };

    return {
        user: userSafe,
        ...userSafe,
        role: user.role,
        branch: branchData,
        subscription,
    };
};

module.exports = {
    registerOwner,
    loginUser,
    logoutUser,
    refreshToken,
    sendOtp,
    verifyOtp,
    changePassword,
    getProfile,
};