const { body, param } = require('express-validator');
const { ORDER_STATUS } = require('../../config/pharmacyConstants');


const NAME_REGEX = /^[a-zA-Z\s.'-]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

const createOrderRules = [
    body('order_type')
        .optional()
        .isIn(['COUNTER', 'DELIVERY', 'PICKUP', 'POS']).withMessage('Valid order_type is required (COUNTER, DELIVERY, PICKUP, POS)'),
    body('items')
        .isArray({ min: 1 }).withMessage('At least one item is required in the order'),
    body('items.*.medicine_id')
        .notEmpty().withMessage('Valid medicine_id is required for all items')
        .isMongoId().withMessage('medicine_id must be a valid ObjectId'),
    body('items.*.batch_id')
        .optional()
        .isMongoId().withMessage('batch_id must be a valid ObjectId'),
    body('items.*.quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be an integer >= 1'),
    body('items.*.discount_percent')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Discount percent must be a number between 0 and 100'),
    body('customer_id')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('customer_id must be a valid ObjectId'),
    body('customer_name')
        .optional()
        .trim()
        .matches(NAME_REGEX).withMessage('Special characters and numbers are not allowed in customer name.'),
    body('delivery_phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Delivery phone must be a valid 10-digit number without letters or special characters.'),
    body('customer_phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PHONE_REGEX).withMessage('Customer phone must be a valid 10-digit number without letters or special characters.'),
    body('delivery_address')
        .optional()
        .trim()
        .isString().withMessage('Delivery address must be a text string'),
    body('delivery_city')
        .optional()
        .trim()
        .matches(/^[a-zA-Z\s.'-]+$/).withMessage('City must contain only letters and spaces'),
    body('delivery_pincode')
        .optional({ checkFalsy: true })
        .trim()
        .matches(PINCODE_REGEX).withMessage('Delivery pincode must be a valid 6-digit number without letters or special characters.'),
    body('payment_mode')
        .optional()
        .isIn(['CASH', 'UPI', 'CARD', 'KHATA', 'SPLIT']).withMessage('Valid payment_mode is required (CASH, UPI, CARD, KHATA, SPLIT)'),
    body('remarks')
        .optional()
        .isString().withMessage('Remarks must be a text string'),
];

const updateOrderStatusRules = [
    param('id').isMongoId().withMessage('Valid order ID is required'),
    body('status').isIn(Object.values(ORDER_STATUS)).withMessage('Valid order status is required'),
    body('remarks').optional().isString(),
];

const assignPackerRules = [
    param('id').isMongoId().withMessage('Valid order ID is required'),
    body('packer_id').isMongoId().withMessage('Valid packer user ID is required'),
];

module.exports = {
    createOrderRules,
    updateOrderStatusRules,
    assignPackerRules,
};

