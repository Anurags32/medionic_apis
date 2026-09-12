const express = require('express');
const router = express.Router();
const posController = require('../../controllers/pharmacy/pos.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const {  authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const validate = require('../../middleware/pharmacy/validate.middleware');
const { FEATURES } = require('../../config/pharmacyConstants');
const { createInvoiceRules } = require('../../validations/pharmacy/pos.validation');

router.use(authenticateToken);
router.post(
    '/invoices',
    authorizeFeature(FEATURES.BILLING_POS),
    validate(createInvoiceRules),
    posController.createInvoice
);

router.post(
    '/walkin-bill',
    authorizeFeature(FEATURES.BILLING_POS),
    validate(createInvoiceRules),
    posController.createInvoice
);

router.get(
    '/invoices',
    authorizeFeature(FEATURES.BILLING_POS),
    posController.getInvoices
);

router.get(
    '/invoices/:id/receipt',
    authorizeFeature(FEATURES.BILLING_POS),
    posController.getInvoiceReceipt
);

router.get(
    '/invoices/:id/bill',
    authorizeFeature(FEATURES.BILLING_POS),
    posController.getInvoiceReceipt
);

router.get(
    '/invoices/:id',
    authorizeFeature(FEATURES.BILLING_POS),
    posController.getInvoiceById
);

module.exports = router;

