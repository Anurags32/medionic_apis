const { body } = require('express-validator');
const { GSTIN_REGEX, DRUG_LICENSE_REGEX } = require('./branch.validation');

const registerOwnerRules = [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('branch_details').isObject().withMessage('Branch details object is required'),
    body('branch_details.name')
        .trim()
        .notEmpty()
        .withMessage('Branch name is required'),
    body('branch_details.drug_license_no')
        .trim()
        .notEmpty()
        .withMessage('Drug license number is required')
        .bail()
        .matches(DRUG_LICENSE_REGEX)
        .withMessage('Invalid drug license format'),
    body('branch_details.gstin')
        .trim()
        .notEmpty()
        .withMessage('GSTIN is required')
        .bail()
        .toUpperCase()
        .matches(GSTIN_REGEX)
        .withMessage('Invalid GSTIN format. Example: 09AAACM1234F1Z5'),
    body('branch_details.address')
        .optional()
        .trim()
        .isLength({ min: 10, max: 255 })
        .withMessage('Address must be at least 10 characters long'),
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