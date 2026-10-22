const express = require('express');
const purchaseController = require('../../controllers/pharmacy/purchase.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const { FEATURES } = require('../../config/pharmacyConstants');
const { requireActiveSubscription } = require('../../middleware/pharmacy/subscription.middleware');

// Purchase entry (supplier bills → stock inward + payables). Reads need
// inventory_view, writes inventory_manage, like the rest of inventory.

const purchases = express.Router();
purchases.use(authenticateToken);
purchases.get('/', authorizeFeature(FEATURES.INVENTORY_VIEW), purchaseController.getPurchases);
purchases.get('/summary', authorizeFeature(FEATURES.INVENTORY_VIEW), purchaseController.getPurchaseSummary);
purchases.post('/', authorizeFeature(FEATURES.INVENTORY_MANAGE), requireActiveSubscription, purchaseController.createPurchase);
purchases.get('/:id', authorizeFeature(FEATURES.INVENTORY_VIEW), purchaseController.getPurchaseById);
purchases.post('/:id/payments', authorizeFeature(FEATURES.INVENTORY_MANAGE), requireActiveSubscription, purchaseController.addPurchasePayment);
purchases.post('/:id/cancel', authorizeFeature(FEATURES.INVENTORY_MANAGE), requireActiveSubscription, purchaseController.cancelPurchase);

const suppliers = express.Router();
suppliers.use(authenticateToken);
suppliers.get('/', authorizeFeature(FEATURES.INVENTORY_VIEW), purchaseController.getSuppliers);
suppliers.post('/', authorizeFeature(FEATURES.INVENTORY_MANAGE), requireActiveSubscription, purchaseController.createSupplier);
suppliers.get('/:id', authorizeFeature(FEATURES.INVENTORY_VIEW), purchaseController.getSupplierById);
suppliers.put('/:id', authorizeFeature(FEATURES.INVENTORY_MANAGE), requireActiveSubscription, purchaseController.updateSupplier);
suppliers.get('/:id/ledger', authorizeFeature(FEATURES.INVENTORY_VIEW), purchaseController.getSupplierLedger);
suppliers.post('/:id/payments', authorizeFeature(FEATURES.INVENTORY_MANAGE), requireActiveSubscription, purchaseController.paySupplier);

module.exports = { purchases, suppliers };
