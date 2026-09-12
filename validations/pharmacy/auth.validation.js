const { body } = require('express-validator');

const registerOwnerRules = [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('branch_details').optional().isObject().withMessage('Branch details must be an object'),
    body('branch_details.name')
        .if(body('branch_details').exists())
        .notEmpty()
        .withMessage('Branch name is required'),
    body('branch_details.drug_license_no')
        .if(body('branch_details').exists())
        .notEmpty()
        .withMessage('Drug license number is required'),
    body('branch_details.gstin')
        .if(body('branch_details').exists())
        .notEmpty()
        .withMessage('GSTIN is required'),
];

const loginRules = [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

const refreshTokenRules = [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

const changePasswordRules = [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long'),
];

const sendOtpRules = [
    body('phone').trim().notEmpty().withMessage('Valid phone number is required'),
    body('purpose').optional().isString().withMessage('Purpose must be a string'),
];

const verifyOtpRules = [
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('otp').trim().isLength({ min: 4, max: 8 }).withMessage('Valid OTP code is required'),
];

module.exports = {
    registerOwnerRules,
    loginRules,
    refreshTokenRules,
    changePasswordRules,
    sendOtpRules,
    verifyOtpRules,
};