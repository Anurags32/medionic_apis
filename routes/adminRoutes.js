const express = require('express');
const router = express.Router();

const {
    adminLogin,
    getDoctors,
    verifyDoctor,
    getMRs,
    verifyMR,
    getUsers,
    suspendUser,
    getDashboard,
    getPendingExpenses,
    approveExpense,
    rejectExpense
} = require('../controllers/adminController');

// Middlewares
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

// Public route
router.post('/login', adminLogin);

// Protected routes (Admin only)
router.use(protect, authorize(constants.ROLES.ADMIN));

router.get('/doctors', getDoctors);
router.put('/doctors/:id/verify', verifyDoctor);

router.get('/mr', getMRs);
router.put('/mr/:id/verify', verifyMR);

router.get('/users', getUsers);
router.put('/users/:id/suspend', suspendUser);

router.get('/dashboard', getDashboard);

router.get('/expenses/pending-approvals', getPendingExpenses);
router.put('/expenses/:id/approve', approveExpense);
router.put('/expenses/:id/reject', rejectExpense);

module.exports = router;
