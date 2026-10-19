const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/pharmacy/customer.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const validate = require('../../middleware/pharmacy/validate.middleware');
const { FEATURES } = require('../../config/pharmacyConstants');
const {
    createCustomerRules,
    updateCustomerRules,
    settleKhataRules,
} = require('../../validations/pharmacy/customer.validation');

router.use(authenticateToken);

router.post(
    '/',
    authorizeFeature(FEATURES.CUSTOMERS_MANAGE),
    validate(createCustomerRules),
    customerController.createCustomer
);

router.get(
    '/',
    authorizeFeature(FEATURES.CUSTOMERS_MANAGE),
    customerController.getCustomers
);

router.get(
    '/:id',
    authorizeFeature(FEATURES.CUSTOMERS_MANAGE),
    customerController.getCustomerById
);

router.get(
    '/:id/ledger',
    authorizeFeature(FEATURES.CUSTOMERS_MANAGE),
    customerController.getCustomerLedger
);

router.post(
    '/:id/settle-khata',
    authorizeFeature(FEATURES.CUSTOMERS_MANAGE),
    validate(settleKhataRules),
    customerController.settleKhata
);

router.post(
    '/:id/settle-ledger',
    authorizeFeature(FEATURES.CUSTOMERS_MANAGE),
    customerController.settleKhata
);

module.exports = router;
