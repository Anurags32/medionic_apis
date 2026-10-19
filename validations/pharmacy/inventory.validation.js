const { body, param } = require('express-validator');

// Regex allowing letters, numbers, spaces, and safe medical naming characters (e.g. Paracetamol 500mg, Amox-Clav (625mg), D-Cold Total)
const MEDICINE_NAME_REGEX = /^[a-zA-Z0-9\s.,()\-+/&%]+$/;
const CATEGORY_NAME_REGEX = /^[a-zA-Z0-9\s.,()\-+/&%]+$/;
const GENERAL_TEXT_REGEX = /^[a-zA-Z0-9\s.,()\-+/&%]+$/;

const createCategoryRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Category name is required')
        .bail()
        .matches(CATEGORY_NAME_REGEX).withMessage('Special characters not allowed in category name. Only letters, numbers, and basic symbols (- & /) are allowed.'),
    body('description')
        .optional()
        .isString().withMessage('Description must be a text string'),
];

const createMedicineRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Medicine name is required')
        .bail()
        .matches(MEDICINE_NAME_REGEX).withMessage('Special characters not allowed in medicine name. Only letters, numbers, spaces and standard symbols (- . ( ) / + %) are allowed.'),

    body('category_id')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('Valid category_id is required'),

    body('generic_name')
        .optional({ checkFalsy: true })
        .trim()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in generic name.'),

    body('sku_barcode')
        .if((value) => value !== undefined)
        .trim()
        .notEmpty().withMessage('SKU is required')
        .bail()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),

    body('sku')
        .if((value, { req }) => value !== undefined && req.body.sku_barcode === undefined)
        .trim()
        .notEmpty().withMessage('SKU is required')
        .bail()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),

    body('manufacturer')
        .if((value) => value !== undefined)
        .trim()
        .notEmpty().withMessage('Manufacturer is required')
        .bail()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in manufacturer'),

    body('hsn_code')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[0-9A-Za-z]+$/).withMessage('HSN code must contain only letters and numbers.'),

    body('form')
        .optional({ checkFalsy: true })
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('Form must contain only alphabets (e.g., Tablet, Syrup).'),

    body('unit')
        .optional({ checkFalsy: true })
        .trim()
        .isString().withMessage('Unit must be a valid string.'),

    body('unit_quantity')
        .optional({ checkFalsy: true })
        .isInt({ min: 1, max: 10000 }).withMessage('Unit quantity must be a positive integer between 1 and 10,000'),

    body('is_prescription_required')
        .optional()
        .isBoolean().withMessage('is_prescription_required must be a boolean (true/false)'),

    body('low_stock_threshold')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 100000 }).withMessage('Low stock threshold must be a non-negative integer between 0 and 100,000'),

    body('purchase_rate')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('Purchase rate must be a valid number between 0 and 10,000,000'),

    body('mrp')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('MRP must be a valid number between 0 and 10,000,000')
        .bail()
        .custom((mrp, { req }) => {
            const purchaseRate = parseFloat(req.body.purchase_rate || req.body.purchaseRate || req.body.purchasePrice);
            if (!isNaN(purchaseRate) && parseFloat(mrp) < purchaseRate) {
                throw new Error('MRP cannot be less than purchase price');
            }
            return true;
        }),

    body('sale_price')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('Sale price must be a valid number between 0 and 10,000,000'),

    body('gst_rate')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 100 }).withMessage('GST rate must be a valid percentage between 0 and 100'),
];

const updateMedicineRules = [
    param('id').isMongoId().withMessage('Valid medicine ID is required'),

    body('name')
        .optional()
        .trim()
        .notEmpty().withMessage('Medicine name cannot be empty')
        .bail()
        .matches(MEDICINE_NAME_REGEX).withMessage('Special characters not allowed in medicine name. Only letters, numbers, spaces and standard symbols (- . ( ) / + %) are allowed.'),

    body('category_id')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('Valid category_id is required'),

    body('generic_name')
        .optional({ checkFalsy: true })
        .trim()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in generic name.'),

    body('sku_barcode')
        .if((value) => value !== undefined)
        .trim()
        .notEmpty().withMessage('SKU is required')
        .bail()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),

    body('sku')
        .if((value, { req }) => value !== undefined && req.body.sku_barcode === undefined)
        .trim()
        .notEmpty().withMessage('SKU is required')
        .bail()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),

    body('manufacturer')
        .if((value) => value !== undefined)
        .trim()
        .notEmpty().withMessage('Manufacturer is required')
        .bail()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in manufacturer'),

    body('hsn_code')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[0-9A-Za-z]+$/).withMessage('HSN code must contain only letters and numbers.'),

    body('form')
        .optional({ checkFalsy: true })
        .trim()
        .isAlpha('en-US', { ignore: ' ' }).withMessage('Form must contain only alphabets.'),

    body('unit')
        .optional({ checkFalsy: true })
        .trim()
        .isString().withMessage('Unit must be a valid string.'),

    body('unit_quantity')
        .optional({ checkFalsy: true })
        .isInt({ min: 1, max: 10000 }).withMessage('Unit quantity must be a positive integer between 1 and 10,000'),

    body('is_prescription_required')
        .optional()
        .isBoolean().withMessage('is_prescription_required must be a boolean (true/false)'),

    body('low_stock_threshold')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 100000 }).withMessage('Low stock threshold must be a non-negative integer between 0 and 100,000'),

    body('purchase_rate')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('Purchase rate must be a valid number between 0 and 10,000,000'),

    body('mrp')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('MRP must be a valid number between 0 and 10,000,000')
        .bail()
        .custom((mrp, { req }) => {
            const purchaseRate = parseFloat(req.body.purchase_rate || req.body.purchaseRate || req.body.purchasePrice);
            if (!isNaN(purchaseRate) && parseFloat(mrp) < purchaseRate) {
                throw new Error('MRP cannot be less than purchase price');
            }
            return true;
        }),

    body('sale_price')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('Sale price must be a valid number between 0 and 10,000,000'),

    body('gst_rate')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 100 }).withMessage('GST rate must be a valid percentage between 0 and 100'),

    body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean (true/false)'),
];

const createBatchRules = [
    body('medicine_id')
        .custom((val, { req }) => {
            const id = val || req.params?.id;
            if (!id) throw new Error('Valid medicine_id is required');
            if (!/^[0-9a-fA-F]{24}$/.test(id)) throw new Error('medicine_id must be a valid ObjectId');
            return true;
        }),

    body('batch_number')
        .trim()
        .notEmpty().withMessage('Batch number is required')
        .bail()
        .matches(/^[a-zA-Z0-9\-_/]+$/).withMessage('Batch number can only contain letters, numbers, hyphens, slashes, and underscores.'),

    body('expiry_date')
        .notEmpty().withMessage('Expiry date is required')
        .bail()
        .isISO8601().withMessage('Valid expiry_date (YYYY-MM-DD) is required')
        .bail()
        .custom((expiry) => {
            const expDate = new Date(expiry);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expDate <= today) {
                throw new Error('Expiry date must be in the future');
            }
            return true;
        }),

    body('mfg_date')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('Valid mfg_date (YYYY-MM-DD) is required'),

    body('purchase_rate')
        .notEmpty().withMessage('Purchase rate is required')
        .bail()
        .isFloat({ min: 0, max: 10000000 }).withMessage('Valid purchase_rate between 0 and 10,000,000 is required'),

    body('mrp')
        .notEmpty().withMessage('MRP is required')
        .bail()
        .isFloat({ min: 0, max: 10000000 }).withMessage('Valid mrp between 0 and 10,000,000 is required')
        .bail()
        .custom((mrp, { req }) => {
            const purchaseRate = parseFloat(req.body.purchase_rate || req.body.purchaseRate || req.body.purchasePrice);
            if (!isNaN(purchaseRate) && parseFloat(mrp) < purchaseRate) {
                throw new Error('MRP cannot be less than purchase price');
            }
            return true;
        }),

    body('sale_price')
        .notEmpty().withMessage('Sale price is required')
        .bail()
        .isFloat({ min: 0, max: 10000000 }).withMessage('Valid sale_price between 0 and 10,000,000 is required'),

    body('gst_rate')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 100 }).withMessage('Valid gst_rate between 0 and 100 is required'),

    body('initial_stock')
        .notEmpty().withMessage('Initial stock is required')
        .bail()
        .isInt({ min: 0, max: 1000000 }).withMessage('Valid initial_stock between 0 and 1,000,000 is required'),

    body('rack_location')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[a-zA-Z0-9\s\-_/]+$/).withMessage('Rack location can only contain alphanumeric characters.'),
];

const createMedicineWithBatchRules = [
    // Medicine validation
    body('name')
        .trim()
        .notEmpty().withMessage('Medicine name is required')
        .bail()
        .matches(MEDICINE_NAME_REGEX).withMessage('Special characters not allowed in medicine name.'),

    body('category_id')
        .optional({ checkFalsy: true })
        .isMongoId().withMessage('Valid category_id is required'),

    body('sku_barcode')
        .if((value) => value !== undefined)
        .trim()
        .notEmpty().withMessage('SKU is required')
        .bail()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),

    body('sku')
        .if((value, { req }) => value !== undefined && req.body.sku_barcode === undefined)
        .trim()
        .notEmpty().withMessage('SKU is required')
        .bail()
        .isAlphanumeric('en-US', { ignore: '-_' }).withMessage('SKU/Barcode must be alphanumeric.'),

    body('manufacturer')
        .if((value) => value !== undefined)
        .trim()
        .notEmpty().withMessage('Manufacturer is required')
        .bail()
        .matches(GENERAL_TEXT_REGEX).withMessage('Special characters not allowed in manufacturer'),

    // Batch validation
    body('batch_number')
        .custom((val, { req }) => {
            const batchNum = val || req.body.batchNumber;
            if (!batchNum || String(batchNum).trim() === '') {
                throw new Error('Batch number is required');
            }
            if (!/^[a-zA-Z0-9\-_/]+$/.test(String(batchNum).trim())) {
                throw new Error('Batch number can only contain letters, numbers, hyphens, slashes, and underscores.');
            }
            return true;
        }),

    body('expiry_date')
        .custom((val, { req }) => {
            const exp = val || req.body.expiryDate;
            if (!exp) {
                throw new Error('Expiry date is required');
            }
            const expDate = new Date(exp);
            if (isNaN(expDate.getTime())) {
                throw new Error('Valid expiry_date (YYYY-MM-DD) is required');
            }
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expDate <= today) {
                throw new Error('Expiry date must be in the future');
            }
            return true;
        }),

    body('mrp')
        .notEmpty().withMessage('MRP is required')
        .bail()
        .isFloat({ min: 0, max: 10000000 }).withMessage('MRP must be a valid number between 0 and 10,000,000')
        .bail()
        .custom((mrp, { req }) => {
            const purchaseRate = parseFloat(req.body.purchase_rate || req.body.purchaseRate || req.body.purchasePrice || 0);
            if (purchaseRate && parseFloat(mrp) < purchaseRate) {
                throw new Error('MRP cannot be less than purchase price');
            }
            return true;
        }),

    body('purchase_rate')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('Purchase rate must be a valid number between 0 and 10,000,000'),

    body('sale_price')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0, max: 10000000 }).withMessage('Sale price must be a valid number between 0 and 10,000,000'),

    body('initial_stock')
        .optional({ checkFalsy: true })
        .isInt({ min: 0, max: 1000000 }).withMessage('Initial stock must be a non-negative integer between 0 and 1,000,000'),
];

const adjustStockRules = [
    body('batch_id')
        .notEmpty().withMessage('Valid batch_id is required')
        .bail()
        .isMongoId().withMessage('batch_id must be a valid ObjectId'),
    body().custom((val, { req }) => {
        const hasDirect = req.body.quantity_changed !== undefined && req.body.transaction_type !== undefined;
        const hasAdjustment = req.body.adjustment_type !== undefined && req.body.quantity !== undefined;
        if (!hasDirect && !hasAdjustment) {
            throw new Error('Either quantity_changed & transaction_type OR adjustment_type & quantity is required');
        }
        return true;
    }),
    body('reason')
        .optional()
        .isString().withMessage('Reason must be a text string'),
];

const processReturnRules = [
    body('batch_id')
        .notEmpty().withMessage('Valid batch_id is required')
        .bail()
        .isMongoId().withMessage('batch_id must be a valid ObjectId'),
    body('quantity')
        .notEmpty().withMessage('quantity is required')
        .bail()
        .isInt({ min: 1, max: 100000 }).withMessage('Quantity must be an integer greater than 0'),
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
    createMedicineWithBatchRules,
    adjustStockRules,
    processReturnRules,
};
