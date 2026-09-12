const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const authService = require('../../services/pharmacy/auth.service');


const registerOwner = asyncHandler(async (req, res) => {
    const result = await authService.registerOwner(req.body);
    res.status(201).json(new ApiResponse(201, result, 'Pharmacy Owner and Branch registered successfully'));
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.status(200).json(new ApiResponse(200, result, 'Login successful'));
});

const logout = asyncHandler(async (req, res) => {
    const result = await authService.logoutUser(req.user.userId);
    res.status(200).json(new ApiResponse(200, result, 'Logout successful'));
});

const sendOtp = asyncHandler(async (req, res) => {
    const { phone, purpose } = req.body;
    const result = await authService.sendOtp(phone, purpose);
    res.status(200).json(new ApiResponse(200, result, 'OTP sent successfully'));
});

const verifyOtp = asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;
    const result = await authService.verifyOtp(phone, otp);
    res.status(200).json(new ApiResponse(200, result, result.message || 'OTP verified successfully'));
});

const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await authService.refreshToken(refreshToken);
    res.status(200).json(new ApiResponse(200, result, 'Token refreshed successfully'));
});

const changePassword = asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body;
    const result = await authService.changePassword(req.user.userId, current_password, new_password);
    res.status(200).json(new ApiResponse(200, result, 'Password changed successfully'));
});

const getMe = asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user.userId);
    res.status(200).json(new ApiResponse(200, user, 'Profile fetched successfully'));
});

module.exports = {
    registerOwner,
    login,
    logout,
    sendOtp,
    verifyOtp,
    refreshToken,
    changePassword,
    getMe,
};