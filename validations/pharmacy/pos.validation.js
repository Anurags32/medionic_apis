const { body } = require('express-validator');

const NAME_REGEX = /^[a-zA-Z\s.'-]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

const createInvoiceRules = [
    body('items')
        .isArray({ min: 1 }).withMessage('At least one item is required in the invoice'),
    body('items.*.medicine_id')
        .notEmpty().withMessage('Valid medicine_id is required for all items')
        .isMongoId().withMessage('medicine_id must be a valid ObjectId'),
    body('items.*.batch_id')
        .notEmpty().withMessage('Valid batch_id is required for all items')
        .isMongoId().withMessage('batch_id must be a valid ObjectId'),
    body('items.*.quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be an integer >= 1'),
    body('items.*.discount_percent')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Discount percent must be a number between 0 and 100'),
    body('customer_id')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('Valid customer_id ObjectId is required'),
    body('patient_name')
        .optional()
        .trim()
        .matches(NAME_REGEX).withMessage('Special characters and numbers are not allowed in patient name.'),
    body('patient_phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Patient phone must be a valid 10-digit number without letters or special characters.'),
    body('customer_phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Customer phone must be a valid 10-digit number without letters or special characters.'),
    body('doctor_name')
        .optional()
        .trim()
        .matches(NAME_REGEX).withMessage('Special characters and numbers are not allowed in doctor name.'),
    body('payment_mode')
        .isIn(['CASH', 'UPI', 'CARD', 'KHATA', 'SPLIT']).withMessage('Valid payment_mode is required (CASH, UPI, CARD, KHATA, SPLIT)'),
    body('amount_paid')
        .optional()
        .isFloat({ min: 0 }).withMessage('Amount paid must be a valid number >= 0'),
    body('notes')
        .optional()
        .isString().withMessage('Notes must be a text string'),
];

module.exports = {
    createInvoiceRules,
};

