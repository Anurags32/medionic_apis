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
    rejectExpense,
    getDoctorProfile,
    getMRProfile,
    approveDoctor,
    rejectDoctor,
    approveMR,
    rejectMR
} = require('../controllers/adminController');

// Middlewares
const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

// Public route
router.post('/login', adminLogin);

// Protected routes (Admin only)
router.use(protect, authorize(constants.ROLES.ADMIN));

router.get('/doctors', getDoctors);
router.get('/doctors/:id', getDoctorProfile);
router.put('/doctors/:id/verify', verifyDoctor);
router.put('/doctors/:id/approve', approveDoctor);
router.put('/doctors/:id/reject', rejectDoctor);

router.get('/mr', getMRs);
router.get('/mr/:id', getMRProfile);
router.put('/mr/:id/verify', verifyMR);
router.put('/mr/:id/approve', approveMR);
router.put('/mr/:id/reject', rejectMR);

router.get('/users', getUsers);
router.put('/users/:id/suspend', suspendUser);

router.get('/dashboard', getDashboard);

router.get('/expenses/pending-approvals', getPendingExpenses);
router.put('/expenses/:id/approve', approveExpense);
router.put('/expenses/:id/reject', rejectExpense);

module.exports = router;
