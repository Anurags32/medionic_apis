const { body, param } = require('express-validator');
const { ROLES } = require('../../config/pharmacyConstants');


const NAME_REGEX = /^[a-zA-Z\s.'-]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

const createStaffRules = [
    body('branch_id').optional().isMongoId().withMessage('Valid branch_id is required'),
    body('full_name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .matches(NAME_REGEX).withMessage('Special characters and numbers are not allowed in staff name.'),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(PHONE_REGEX).withMessage('Phone number must be a valid 10-digit number without letters or special characters.'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('role')
        .isIn([ROLES.PHARMACIST, ROLES.PICKER_PACKER, ROLES.CASHIER])
        .withMessage('Role must be one of: PHARMACIST, PICKER_PACKER, CASHIER'),
    body('pharmacist_reg_no')
        .if(body('role').equals(ROLES.PHARMACIST))
        .optional()
        .isString(),
    body('features_granted')
        .optional()
        .isArray()
        .withMessage('features_granted must be an array of feature strings'),
];

const updateStaffRules = [
    param('id').isMongoId().withMessage('Valid staff ID is required'),
    body('full_name')
        .optional()
        .trim()
        .notEmpty().withMessage('Full name cannot be empty')
        .matches(NAME_REGEX).withMessage('Special characters and numbers are not allowed in staff name.'),
    body('phone')
        .optional()
        .trim()
        .notEmpty().withMessage('Phone number cannot be empty')
        .matches(PHONE_REGEX).withMessage('Phone number must be a valid 10-digit number without letters or special characters.'),
    body('role')
        .optional()
        .isIn([ROLES.PHARMACIST, ROLES.PICKER_PACKER, ROLES.CASHIER])
        .withMessage('Role must be PHARMACIST, PICKER_PACKER, or CASHIER'),
    body('pharmacist_reg_no').optional().isString(),
];

const updatePermissionsRules = [
    param('id').notEmpty().withMessage('Valid staff ID is required'),
    body('features')
        .isArray()
        .withMessage('features must be an array of feature strings'),
];

const blockStaffRules = [
    param('id').notEmpty().withMessage('Valid staff ID is required'),
    body('is_blocked').isBoolean().withMessage('is_blocked must be a boolean (true/false)'),
    body('block_reason').optional().isString(),
];

const updateDutyRules = [
    body('duty_status').isIn(['ON_DUTY', 'OFF_DUTY']).withMessage("duty_status must be 'ON_DUTY' or 'OFF_DUTY'"),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Valid latitude between -90 and 90 is required'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Valid longitude between -180 and 180 is required'),
    body('address').optional().isString(),
];

const updateLocationRules = [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude between -90 and 90 is required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude between -180 and 180 is required'),
    body('address').optional().isString(),
];

const transferBranchRules = [
    param('id').isMongoId().withMessage('Valid staff ID is required'),
    body('branch_id').isMongoId().withMessage('Valid target branch_id is required'),
];

module.exports = {
    createStaffRules,
    updateStaffRules,
    updatePermissionsRules,
    blockStaffRules,
    updateDutyRules,
    updateLocationRules,
    transferBranchRules,
};
