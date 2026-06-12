const express = require('express');
const router = express.Router();

// Import controller functions
const {
    getProfile,
    updateProfile,
    getDoctors,
    getDoctorDetails,
    requestMeeting,
    getMeetingRequests,
    getVisitPlan,
    submitDCR,
    getDCRList,
    getSampleInventory,
    distributeSamples,
    getTerritoryAnalytics,
    getExpenseReport
} = require('../controllers/mrController');

// Import middleware
const { protect, authorize, profileComplete } = require('../middleware/auth');
const { canAccessMRMeeting } = require('../middleware/roleAuth');
const constants = require('../config/constants');

// All routes are protected and require MR role
router.use(protect, authorize(constants.ROLES.MR), profileComplete);

// MR profile routes
router.route('/profile')
    .get(getProfile)
    .put(updateProfile);

// Doctor routes
router.get('/doctors', getDoctors);
router.get('/doctors/:id', getDoctorDetails);

// Meeting request routes
router.route('/meeting-requests')
    .get(getMeetingRequests)
    .post(requestMeeting);

// Visit planning routes
router.get('/visit-plan', getVisitPlan);

// DCR (Daily Call Report) routes
router.route('/dcr')
    .get(getDCRList)
    .post(submitDCR);

// Sample management routes
router.get('/samples', getSampleInventory);
router.post('/samples/distribute', distributeSamples);

// Analytics routes
router.get('/analytics', getTerritoryAnalytics);

// Expense routes
router.get('/expenses', getExpenseReport);

module.exports = router;