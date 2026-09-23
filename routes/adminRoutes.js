const express = require('express');
const router = express.Router();

const {
    adminRegister,
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
    rejectMR,
    getPatients,
    getPatientProfile,
    getPharmacyOwners,
    approvePharmacyOwner,
    rejectPharmacyOwner,
    getPharmacyOwnerProfile,
    getPaymentDashboard,
    getAllPaymentTransactions,
    getAppointmentPayments,
    getPharmacyInvoices,
    getPharmacyOrders,
    getMRExpenses,
} = require('../controllers/adminController');

const { protect, authorize } = require('../middleware/auth');
const constants = require('../config/constants');

// ─── Public routes (no auth required) ────────────────────────────────────────
router.post('/register', adminRegister);
router.post('/login', adminLogin);

// ─── All routes below require Admin auth ──────────────────────────────────────
router.use(protect, authorize(constants.ROLES.ADMIN));

// Dashboard
router.get('/dashboard', getDashboard);

// Doctors
router.get('/doctors', getDoctors);
router.get('/doctors/:id', getDoctorProfile);
router.put('/doctors/:id/verify', verifyDoctor);
router.put('/doctors/:id/approve', approveDoctor);
router.put('/doctors/:id/reject', rejectDoctor);

// MRs
router.get('/mr', getMRs);
router.get('/mr/:id', getMRProfile);
router.put('/mr/:id/verify', verifyMR);
router.put('/mr/:id/approve', approveMR);
router.put('/mr/:id/reject', rejectMR);

// Patients
router.get('/patients', getPatients);
router.get('/patients/:id', getPatientProfile);

// Pharmacy Owners
router.get('/pharmacy-owners', getPharmacyOwners);
router.get('/pharmacy-owners/:id', getPharmacyOwnerProfile);
router.put('/pharmacy-owners/:id/approve', approvePharmacyOwner);
router.put('/pharmacy-owners/:id/reject', rejectPharmacyOwner);

// All Users
router.get('/users', getUsers);
router.put('/users/:id/suspend', suspendUser);

// Expenses
router.get('/expenses/pending-approvals', getPendingExpenses);
router.put('/expenses/:id/approve', approveExpense);
router.put('/expenses/:id/reject', rejectExpense);

// Payments & Revenue (Doctor, Patient, Pharmacy, MR)
router.get('/payments/dashboard', getPaymentDashboard);
router.get('/payments/transactions', getAllPaymentTransactions);
router.get('/payments/appointments', getAppointmentPayments);
router.get('/payments/pharmacy-invoices', getPharmacyInvoices);
router.get('/payments/pharmacy-orders', getPharmacyOrders);
router.get('/payments/mr-expenses', getMRExpenses);

module.exports = router;
