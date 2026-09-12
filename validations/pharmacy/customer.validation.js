const { body, param } = require('express-validator');

const NAME_REGEX = /^[a-zA-Z\s.'-]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

const createCustomerRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Customer name is required')
        .matches(NAME_REGEX).withMessage('Special characters and numbers are not allowed in customer name. Only letters, spaces, dots, and hyphens are allowed.'),
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(PHONE_REGEX).withMessage('Phone number must be a valid 10-digit number without letters or special characters.'),
    body('email')
        .optional({ checkFalsy: true })
        .trim()
        .isEmail().withMessage('Valid email is required'),
    body('address')
        .optional()
        .trim()
        .isString().withMessage('Address must be a text string'),
    body('city')
        .optional()
        .trim()
        .matches(/^[a-zA-Z\s.'-]+$/).withMessage('City must contain only alphabets and spaces'),
    body('pincode')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PINCODE_REGEX).withMessage('Pincode must be a valid 6-digit number without letters or special characters.'),
];

const updateCustomerRules = [
    param('id').isMongoId().withMessage('Valid customer ID is required'),
    body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('Customer name cannot be empty')
        .matches(NAME_REGEX).withMessage('Special characters and numbers are not allowed in customer name. Only letters, spaces, dots, and hyphens are allowed.'),
    body('phone')
        .optional()
        .trim()
        .notEmpty().withMessage('Phone number cannot be empty')
        .matches(PHONE_REGEX).withMessage('Phone number must be a valid 10-digit number without letters or special characters.'),
    body('email')
        .optional({ checkFalsy: true })
        .trim()
        .isEmail().withMessage('Valid email is required'),
    body('address')
        .optional()
        .trim()
        .isString().withMessage('Address must be a text string'),
    body('city')
        .optional()
        .trim()
        .matches(/^[a-zA-Z\s.'-]+$/).withMessage('City must contain only alphabets and spaces'),
    body('pincode')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PINCODE_REGEX).withMessage('Pincode must be a valid 6-digit number without letters or special characters.'),
];

const settleKhataRules = [
    param('id').isMongoId().withMessage('Valid customer ID is required'),
    body('amount')
        .isFloat({ gt: 0 }).withMessage('Amount must be a positive number greater than 0'),
    body('payment_mode')
        .isIn(['CASH', 'UPI', 'CARD']).withMessage('Valid payment_mode is required (CASH, UPI, or CARD)'),
    body('notes')
        .optional()
        .isString().withMessage('Notes must be a text string'),
];

module.exports = {
    createCustomerRules,
    updateCustomerRules,
    settleKhataRules,
};

