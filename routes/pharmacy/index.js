const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const staffRoutes = require('./staff.routes');
const branchRoutes = require('./branch.routes');
const inventoryRoutes = require('./inventory.routes');
const customerRoutes = require('./customer.routes');
const prescriptionRoutes = require('./prescription.routes');
const posRoutes = require('./pos.routes');
const orderRoutes = require('./order.routes');
const reportRoutes = require('./report.routes');
const notificationRoutes = require('./notification.routes');
const returnRoutes = require('./return.routes');

const { planGuard } = require('../../middleware/pharmacy/subscription.middleware');

router.use('/auth', authRoutes);
router.use(planGuard);
router.use('/staff', staffRoutes);
router.use('/branch', branchRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/returns', returnRoutes);
router.use('/customers', customerRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/pos', posRoutes);
router.use('/orders', orderRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;