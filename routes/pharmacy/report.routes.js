const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/pharmacy/report.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const { FEATURES } = require('../../config/pharmacyConstants');

router.use(authenticateToken);
router.use(authorizeFeature(FEATURES.REPORTS_VIEW));

router.get('/dashboard', reportController.getDashboardStats);
router.get('/sales', reportController.getSalesReport);
router.get('/top-medicines', reportController.getTopSellingMedicines);
router.get('/gst', reportController.getGstReport);

module.exports = router;
