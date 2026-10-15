const { body, param } = require('express-validator');

// Indian GSTIN format (15 characters: 2 digits state code + 10 chars PAN + 1 entity char + Z + 1 check digit)
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Standard Drug License format in India (must include numbers and valid license symbols, e.g. DL-UP-LKO-2026-98765, 20B/21B-12345)
const DRUG_LICENSE_REGEX = /^(?=.*[0-9])[A-Za-z0-9/.\- ]{6,35}$/;

// Standard Indian mobile number with optional +91 prefix
const PHONE_REGEX = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

// Indian Postal PIN code (6 digits)
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const createBranchRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Branch name is required')
        .bail()
        .isLength({ min: 3, max: 100 }).withMessage('Branch name must be between 3 and 100 characters long'),

    body('drug_license_no')
        .trim()
        .notEmpty().withMessage('Drug license number is required')
        .bail()
        .matches(DRUG_LICENSE_REGEX).withMessage('Invalid drug license format. Must be 6-35 characters with alphanumeric, slash, hyphen, or dot.'),

    body('gstin')
        .trim()
        .notEmpty().withMessage('GSTIN is required')
        .bail()
        .toUpperCase()
        .matches(GSTIN_REGEX).withMessage('Invalid GSTIN format. Example: 09AAACM1234F1Z5 (15 characters).'),

    body('address')
        .trim()
        .notEmpty().withMessage('Address is required')
        .bail()
        .custom((val) => {
            const trimmed = String(val).trim();
            if (/^\d+$/.test(trimmed)) {
                throw new Error('Address cannot be numeric only');
            }
            if (trimmed.length < 10) {
                throw new Error('Address must be at least 10 characters long');
            }
            return true;
        }),

    body('contact_number')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Invalid contact phone number format. Must be a valid 10-digit mobile number.'),

    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Invalid contact phone number format. Must be a valid 10-digit mobile number.'),

    body('email')
        .optional({ checkFalsy: true })
        .trim()
        .isEmail().withMessage('Invalid email address format'),

    body('city')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('City must be between 2 and 100 characters long'),

    body('pincode')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PINCODE_REGEX).withMessage('Pincode must be a valid 6-digit Indian postal code'),

    body('latitude')
        .optional({ checkFalsy: true })
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid coordinate between -90 and 90'),

    body('longitude')
        .optional({ checkFalsy: true })
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid coordinate between -180 and 180'),
];

const updateBranchRules = [
    param('id')
        .optional()
        .isMongoId().withMessage('Valid branch ID is required'),

    body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('Branch name cannot be empty')
        .bail()
        .isLength({ min: 3, max: 100 }).withMessage('Branch name must be between 3 and 100 characters long'),

    body('drug_license_no')
        .optional()
        .trim()
        .notEmpty().withMessage('Drug license number cannot be empty')
        .bail()
        .matches(DRUG_LICENSE_REGEX).withMessage('Invalid drug license format. Must be 6-35 characters with alphanumeric, slash, hyphen, or dot.'),

    body('gstin')
        .optional()
        .trim()
        .notEmpty().withMessage('GSTIN cannot be empty')
        .bail()
        .toUpperCase()
        .matches(GSTIN_REGEX).withMessage('Invalid GSTIN format. Example: 09AAACM1234F1Z5 (15 characters).'),

    body('address')
        .optional()
        .trim()
        .notEmpty().withMessage('Address cannot be empty')
        .bail()
        .custom((val) => {
            const trimmed = String(val).trim();
            if (/^\d+$/.test(trimmed)) {
                throw new Error('Address cannot be numeric only');
            }
            if (trimmed.length < 10) {
                throw new Error('Address must be at least 10 characters long');
            }
            return true;
        }),

    body('contact_number')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Invalid contact phone number format. Must be a valid 10-digit mobile number.'),

    body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Invalid contact phone number format. Must be a valid 10-digit mobile number.'),

    body('email')
        .optional({ checkFalsy: true })
        .trim()
        .isEmail().withMessage('Invalid email address format'),

    body('city')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('City must be between 2 and 100 characters long'),

    body('pincode')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PINCODE_REGEX).withMessage('Pincode must be a valid 6-digit Indian postal code'),

    body('latitude')
        .optional({ checkFalsy: true })
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be a valid coordinate between -90 and 90'),

    body('longitude')
        .optional({ checkFalsy: true })
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be a valid coordinate between -180 and 180'),
];

module.exports = {
    createBranchRules,
    updateBranchRules,
    GSTIN_REGEX,
    DRUG_LICENSE_REGEX,
    PHONE_REGEX,
    PINCODE_REGEX,
};
