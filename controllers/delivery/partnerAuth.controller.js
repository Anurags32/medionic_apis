const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { DeliveryPartner } = require('../../models/delivery');
const {
    PARTNER_TYPES,
    PARTNER_ACCOUNT_STATUS,
    PARTNER_VERIFICATION_STATUS,
} = require('../../config/deliveryConstants');
const { generatePartnerToken, generateRefreshToken } = require('../../utils/deliveryJwt');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const constants = require('../../config/constants');

// Register a new Platform Partner
const register = asyncHandler(async (req, res) => {
    const { full_name, email, mobile, password, vehicle_type, vehicle_number } = req.body;

    if (!full_name || !email || !mobile || !password) {
        throw new ApiError(400, 'Full name, email, mobile, and password are required', 'FIELDS_REQUIRED');
    }

    const existingEmail = await DeliveryPartner.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
        throw new ApiError(409, 'Email is already registered', 'EMAIL_EXISTS');
    }

    const existingMobile = await DeliveryPartner.findOne({ mobile: mobile.trim() });
    if (existingMobile) {
        throw new ApiError(409, 'Mobile number is already registered', 'MOBILE_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const partner_code = await DeliveryPartner.generatePartnerCode(PARTNER_TYPES.PLATFORM_PARTNER);

    const partner = await DeliveryPartner.create({
        partner_code,
        partner_type: PARTNER_TYPES.PLATFORM_PARTNER,
        full_name: full_name.trim(),
        email: email.toLowerCase().trim(),
        mobile: mobile.trim(),
        password_hash,
        vehicle_type: vehicle_type || 'MOTORCYCLE',
        vehicle_number: vehicle_number ? vehicle_number.trim().toUpperCase() : null,
        verification_status: PARTNER_VERIFICATION_STATUS.PENDING,
        account_status: PARTNER_ACCOUNT_STATUS.ACTIVE,
        is_online: false,
        is_available: true,
    });

    const token = generatePartnerToken(partner);
    const refreshToken = generateRefreshToken(partner);

    res.status(201).json({
        success: true,
        message: 'Delivery partner registered successfully',
        data: {
            token,
            refreshToken,
            partner: {
                id: partner._id,
                partner_code: partner.partner_code,
                full_name: partner.full_name,
                email: partner.email,
                mobile: partner.mobile,
                partner_type: partner.partner_type,
                verification_status: partner.verification_status,
                account_status: partner.account_status,
            },
        },
    });
});

// Partner Login
const login = asyncHandler(async (req, res) => {
    const { identifier, email, mobile, password, fcm_token, fcm_platform } = req.body;
    const loginKey = (identifier || email || mobile || '').trim().toLowerCase();

    if (!loginKey || !password) {
        throw new ApiError(400, 'Email/Mobile and password are required', 'CREDENTIALS_REQUIRED');
    }

    const partner = await DeliveryPartner.findOne({
        $or: [{ email: loginKey }, { mobile: loginKey }],
    });

    if (!partner) {
        throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const isMatch = await partner.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (partner.account_status === PARTNER_ACCOUNT_STATUS.BLOCKED) {
        throw new ApiError(403, 'Account is blocked. Contact support.', 'ACCOUNT_BLOCKED');
    }

    if (fcm_token) {
        partner.fcm_token = fcm_token;
        partner.fcm_platform = fcm_platform || partner.fcm_platform;
    }
    await partner.save();

    const token = generatePartnerToken(partner);
    const refreshToken = generateRefreshToken(partner);

    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
            token,
            refreshToken,
            partner: {
                id: partner._id,
                partner_code: partner.partner_code,
                full_name: partner.full_name,
                email: partner.email,
                mobile: partner.mobile,
                partner_type: partner.partner_type,
                verification_status: partner.verification_status,
                account_status: partner.account_status,
                is_online: partner.is_online,
                is_available: partner.is_available,
                pharmacy_id: partner.pharmacy_id,
            },
        },
    });
});

// Send OTP
const sendOtp = asyncHandler(async (req, res) => {
    const { mobile } = req.body;
    if (!mobile) {
        throw new ApiError(400, 'Mobile number is required', 'MOBILE_REQUIRED');
    }

    const partner = await DeliveryPartner.findOne({ mobile: mobile.trim() });
    if (!partner) {
        throw new ApiError(404, 'No delivery partner account found with this mobile', 'PARTNER_NOT_FOUND');
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const code_hash = await bcrypt.hash(otpCode, salt);

    partner.otp = {
        code_hash,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        purpose: 'LOGIN_OR_VERIFY',
    };
    await partner.save();

    // In non-production, return otp for testing convenience
    const responseData = { mobile: partner.mobile };
    if (process.env.NODE_ENV !== 'production') {
        responseData.otp = otpCode;
    }

    res.status(200).json({
        success: true,
        message: 'OTP sent successfully to registered mobile',
        data: responseData,
    });
});

// Verify OTP
const verifyOtp = asyncHandler(async (req, res) => {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
        throw new ApiError(400, 'Mobile and OTP code are required', 'OTP_REQUIRED');
    }

    const partner = await DeliveryPartner.findOne({ mobile: mobile.trim() });
    if (!partner || !partner.otp || !partner.otp.code_hash) {
        throw new ApiError(400, 'No active OTP request found for this mobile', 'OTP_NOT_FOUND');
    }

    if (new Date() > partner.otp.expires_at) {
        throw new ApiError(400, 'OTP has expired. Please request a new one.', 'OTP_EXPIRED');
    }

    const isMatch = await bcrypt.compare(String(otp).trim(), partner.otp.code_hash);
    if (!isMatch) {
        throw new ApiError(400, 'Invalid OTP code', 'INVALID_OTP');
    }

    partner.otp = undefined;
    await partner.save();

    const token = generatePartnerToken(partner);
    const refreshToken = generateRefreshToken(partner);

    res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        data: {
            token,
            refreshToken,
            partner: {
                id: partner._id,
                partner_code: partner.partner_code,
                full_name: partner.full_name,
                email: partner.email,
                mobile: partner.mobile,
                partner_type: partner.partner_type,
            },
        },
    });
});

// Forgot Password
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new ApiError(400, 'Email is required', 'EMAIL_REQUIRED');
    }

    const partner = await DeliveryPartner.findOne({ email: email.toLowerCase().trim() });
    if (!partner) {
        // Return success to avoid email enumeration
        return res.status(200).json({
            success: true,
            message: 'If the email exists, a password reset instruction has been sent.',
        });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    partner.reset_password_token = crypto.createHash('sha256').update(resetToken).digest('hex');
    partner.reset_password_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await partner.save();

    const data = { email: partner.email };
    if (process.env.NODE_ENV !== 'production') {
        data.resetToken = resetToken;
    }

    res.status(200).json({
        success: true,
        message: 'Password reset token generated',
        data,
    });
});

// Reset Password
const resetPassword = asyncHandler(async (req, res) => {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
        throw new ApiError(400, 'Reset token and new password are required', 'PARAMS_REQUIRED');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const partner = await DeliveryPartner.findOne({
        reset_password_token: hashedToken,
        reset_password_expires: { $gt: new Date() },
    });

    if (!partner) {
        throw new ApiError(400, 'Password reset token is invalid or has expired', 'INVALID_TOKEN');
    }

    const salt = await bcrypt.genSalt(10);
    partner.password_hash = await bcrypt.hash(new_password, salt);
    partner.reset_password_token = undefined;
    partner.reset_password_expires = undefined;
    partner.token_version = (partner.token_version || 1) + 1;
    await partner.save();

    res.status(200).json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.',
    });
});

// Refresh Token
const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken: incomingToken } = req.body;
    if (!incomingToken) {
        throw new ApiError(400, 'Refresh token required', 'REFRESH_TOKEN_REQUIRED');
    }

    let decoded;
    try {
        decoded = jwt.verify(incomingToken, process.env.JWT_SECRET || constants.JWT_SECRET);
    } catch (err) {
        throw new ApiError(401, 'Invalid or expired refresh token', 'TOKEN_INVALID');
    }

    const partner = await DeliveryPartner.findById(decoded.id);
    if (!partner) {
        throw new ApiError(401, 'Partner not found', 'PARTNER_NOT_FOUND');
    }

    const token = generatePartnerToken(partner);
    const newRefreshToken = generateRefreshToken(partner);

    res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: { token, refreshToken: newRefreshToken },
    });
});

// Logout
const logout = asyncHandler(async (req, res) => {
    if (req.deliveryPartner) {
        req.deliveryPartner.fcm_token = null;
        req.deliveryPartner.is_online = false;
        await req.deliveryPartner.save();
    }

    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
});

// Get Current Partner (me)
const getMe = asyncHandler(async (req, res) => {
    const partner = await DeliveryPartner.findById(req.deliveryPartner._id)
        .populate('pharmacy_id', 'name code address contact_number');

    res.status(200).json({
        success: true,
        data: partner,
    });
});

module.exports = {
    register,
    login,
    sendOtp,
    verifyOtp,
    forgotPassword,
    resetPassword,
    refreshToken,
    logout,
    getMe,
};

