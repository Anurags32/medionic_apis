const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/pharmacy/inventory.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const validate = require('../../middleware/pharmacy/validate.middleware');
const { FEATURES } = require('../../config/pharmacyConstants');
const { uploadMedicineImage } = require('../../utils/pharmacyUpload');
const {
    createCategoryRules,
    createMedicineRules,
    updateMedicineRules,
    createBatchRules,
    createMedicineWithBatchRules,
    adjustStockRules,
    processReturnRules,
} = require('../../validations/pharmacy/inventory.validation');
const { requireActiveSubscription } = require('../../middleware/pharmacy/subscription.middleware');

router.use(authenticateToken);

router.get('/categories', authorizeFeature(FEATURES.INVENTORY_VIEW), inventoryController.getCategories);
router.post(
    '/categories',
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    validate(createCategoryRules),
    inventoryController.createCategory
);

router.get('/medicines', authorizeFeature(FEATURES.INVENTORY_VIEW), inventoryController.getMedicines);
router.get('/medicines/:id', authorizeFeature(FEATURES.INVENTORY_VIEW), inventoryController.getMedicineById);
router.post(
    '/medicines/with-batch',
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    requireActiveSubscription,
    uploadMedicineImage.single('image'),
    validate(createMedicineWithBatchRules),
    inventoryController.createMedicineWithBatch
);
router.post(
    '/medicines',
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    requireActiveSubscription,
    uploadMedicineImage.single('image'),
    validate(createMedicineRules),
    inventoryController.createMedicine
);
router.put(
    '/medicines/:id',
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    uploadMedicineImage.single('image'),
    validate(updateMedicineRules),
    inventoryController.updateMedicine
);

router.post(
    '/batches',
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    requireActiveSubscription,
    validate(createBatchRules),
    inventoryController.createBatch
);

router.post(
    '/adjust-stock',
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    validate(adjustStockRules),
    inventoryController.adjustStock
);

router.post(
    '/returns',
    authorizeFeature(FEATURES.INVENTORY_MANAGE),
    validate(processReturnRules),
    inventoryController.processReturn
);

router.get(
    '/returns',
    authorizeFeature(FEATURES.INVENTORY_VIEW),
    require('../../controllers/pharmacy/return.controller').getReturns
);

router.get(
    '/barcode/:barcode',
    authorizeFeature(FEATURES.INVENTORY_VIEW),
    inventoryController.lookupBarcode
);

router.get(
    '/alerts/low-stock',
    authorizeFeature(FEATURES.INVENTORY_VIEW),
    inventoryController.getLowStock
);

router.get(
    '/alerts/expiring',
    authorizeFeature(FEATURES.INVENTORY_VIEW),
    inventoryController.getExpiringBatches
);

module.exports = router;
