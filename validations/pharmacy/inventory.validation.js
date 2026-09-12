const { body, param } = require('express-validator');

// Regex allowing letters, numbers, spaces, and safe medical naming characters (e.g. Paracetamol 500mg, Amox-Clav (625mg), D-Cold Total)
const MEDICINE_NAME_REGEX = /^[a-zA-Z0-9\s.,()\-+/&%]+$/;
const CATEGORY_NAME_REGEX = /^[a-zA-Z0-9\s.,()\-+/&%]+$/;
const GENERAL_TEXT_REGEX = /^[a-zA-Z0-9\s.,()\-+/&%]+$/;

const createCategoryRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Category name is required')
        .matches(CATEGORY_NAME_REGEX).withMessage('Special characters not allowed in category name. Only letters, numbers, and basic symbols (- & /) are allowed.'),
    body('description')
        .optional()
        .isString().withMessage('Description must be a text string'),
];

const createMedicineRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Medicine name is required')
        .matches(MEDICINE_NAME_REGEX).withMessage('Special characters not allowed in medicine name. Only letters, numbers, spaces and standard symbols (- . ( ) / + %) are allowed.'),
    body('category_id')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('Valid category_id is required'),
    body('generic_name')
        .optional()
        .trim()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in generic name.'),
    body('sku_barcode')
        .optional()
        .trim()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),
    body('manufacturer')
        .optional()
        .trim()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in manufacturer name.'),
    body('hsn_code')
        .optional()
        .trim()
        .matches(/^[0-9A-Za-z]+$/).withMessage('HSN code must contain only letters and numbers.'),
    body('form')
        .optional()
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('Form must contain only alphabets (e.g., Tablet, Syrup).'),
    body('unit')
        .optional()
        .trim()
        .isString().withMessage('Unit must be a valid string.'),
    body('unit_quantity')
        .optional()
        .isInt({ min: 1 }).withMessage('Unit quantity must be a positive integer >= 1'),
    body('is_prescription_required')
        .optional()
        .isBoolean().withMessage('is_prescription_required must be a boolean (true/false)'),
    body('low_stock_threshold')
        .optional()
        .isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer >= 0'),
    body('mrp')
        .optional()
        .isFloat({ min: 0 }).withMessage('MRP must be a valid number >= 0'),
    body('sale_price')
        .optional()
        .isFloat({ min: 0 }).withMessage('Sale price must be a valid number >= 0'),
    body('purchase_rate')
        .optional()
        .isFloat({ min: 0 }).withMessage('Purchase rate must be a valid number >= 0'),
    body('gst_rate')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('GST rate must be a valid percentage between 0 and 100'),
];

const updateMedicineRules = [
    param('id').isMongoId().withMessage('Valid medicine ID is required'),
    body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('Medicine name cannot be empty')
        .matches(MEDICINE_NAME_REGEX).withMessage('Special characters not allowed in medicine name. Only letters, numbers, spaces and standard symbols (- . ( ) / + %) are allowed.'),
    body('category_id')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('Valid category_id is required'),
    body('generic_name')
        .optional()
        .trim()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in generic name.'),
    body('sku_barcode')
        .optional()
        .trim()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),
    body('manufacturer')
        .optional()
        .trim()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in manufacturer name.'),
    body('hsn_code')
        .optional()
        .trim()
        .matches(/^[0-9A-Za-z]+$/).withMessage('HSN code must contain only letters and numbers.'),
    body('form')
        .optional()
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('Form must contain only alphabets.'),
    body('unit')
        .optional()
        .trim()
        .isString().withMessage('Unit must be a valid string.'),
    body('unit_quantity')
        .optional()
        .isInt({ min: 1 }).withMessage('Unit quantity must be a positive integer >= 1'),
    body('is_prescription_required')
        .optional()
        .isBoolean().withMessage('is_prescription_required must be a boolean (true/false)'),
    body('low_stock_threshold')
        .optional()
        .isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer >= 0'),
    body('mrp')
        .optional()
        .isFloat({ min: 0 }).withMessage('MRP must be a valid number >= 0'),
    body('sale_price')
        .optional()
        .isFloat({ min: 0 }).withMessage('Sale price must be a valid number >= 0'),
    body('purchase_rate')
        .optional()
        .isFloat({ min: 0 }).withMessage('Purchase rate must be a valid number >= 0'),
    body('gst_rate')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('GST rate must be a valid percentage between 0 and 100'),
    body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean (true/false)'),
];

const createBatchRules = [
    body('medicine_id')
        .notEmpty().withMessage('Valid medicine_id is required')
        .isMongoId().withMessage('medicine_id must be a valid ObjectId'),
    body('batch_number')
        .trim()
        .notEmpty().withMessage('Batch number is required')
        .matches(/^[a-zA-Z0-9\-_/]+$/).withMessage('Batch number can only contain letters, numbers, hyphens, slashes, and underscores.'),
    body('expiry_date')
        .isISO8601().withMessage('Valid expiry_date (YYYY-MM-DD) is required'),
    body('mfg_date')
        .optional()
        .isISO8601().withMessage('Valid mfg_date (YYYY-MM-DD) is required'),
    body('purchase_rate')
        .isFloat({ min: 0 }).withMessage('Valid purchase_rate is required (>= 0)'),
    body('mrp')
        .isFloat({ min: 0 }).withMessage('Valid mrp is required (>= 0)'),
    body('sale_price')
        .isFloat({ min: 0 }).withMessage('Valid sale_price is required (>= 0)'),
    body('gst_rate')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Valid gst_rate between 0 and 100 is required'),
    body('initial_stock')
        .isInt({ min: 0 }).withMessage('Valid initial_stock is required (must be integer >= 0)'),
    body('rack_location')
        .optional()
        .trim()
        .matches(/^[a-zA-Z0-9\s\-_/]+$/).withMessage('Rack location can only contain alphanumeric characters.'),
];

const adjustStockRules = [
    body('batch_id')
        .notEmpty().withMessage('Valid batch_id is required')
        .isMongoId().withMessage('batch_id must be a valid ObjectId'),
    body('quantity_changed')
        .isInt().withMessage('Quantity changed must be an integer'),
    body('transaction_type')
        .isIn(['PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'DAMAGED_EXPIRED_OUT', 'ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])
        .withMessage('Invalid transaction_type'),
    body('reason')
        .optional()
        .isString().withMessage('Reason must be a text string'),
];

const processReturnRules = [
    body('batch_id')
        .notEmpty().withMessage('Valid batch_id is required')
        .isMongoId().withMessage('batch_id must be a valid ObjectId'),
    body('quantity')
        .isInt({ min: 1 }).withMessage('Quantity must be an integer greater than 0'),
    body('action')
        .isIn(['RESTOCK', 'DISPOSE'])
        .withMessage("Action must be either 'RESTOCK' or 'DISPOSE'"),
    body('reason')
        .optional()
        .isString().withMessage('Reason must be a text string'),
    body('reference_id')
        .optional()
        .isString().withMessage('Reference ID must be a text string'),
];

module.exports = {
    createCategoryRules,
    createMedicineRules,
    updateMedicineRules,
    createBatchRules,
    adjustStockRules,
    processReturnRules,
};

