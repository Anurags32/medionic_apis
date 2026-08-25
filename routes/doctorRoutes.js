const express = require('express');
const router = express.Router();


const {
    getProfile,
    updateProfile,
    getSchedule,
    updateSchedule,
    getAppointments,
    getAppointmentDetails,
    completeAppointment,
    confirmAppointment,
    cancelAppointmentDoctor,
    updateAppointmentStatus,
    createPrescription,
    getPrescriptions,
    getDashboard,
    getPatients,
    getPatientProfileForDoctor,
    getMRMeetings,
    approveMRMeeting,
    rejectMRMeeting
} = require('../controllers/doctorController');

const {
    getRevenueAnalytics,
    getRatingAnalytics,
    getAppointmentTrends,
    getEarnings,
    requestWithdrawal,
    getEarningsHistory,
    submitVerificationDocuments,
    getDoctorAnalytics
} = require('../controllers/doctorExtendedController');

const { protect, authorize, profileComplete } = require('../middleware/auth');
const { canAccessDoctorData, canAccessPatientData, canAccessAppointment, canWritePrescription, canAccessMRMeeting } = require('../middleware/roleAuth');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');
const idempotent = require('../middleware/idempotency');

router.use(protect, authorize(constants.ROLES.DOCTOR), profileComplete);

router.route('/profile')
    .get(getProfile)
    .put(validate('updateDoctorProfile'), updateProfile);

router.route('/schedule')
    .get(getSchedule)
    .put(updateSchedule);

router.get('/dashboard', getDashboard);

router.route('/appointments')
    .get(getAppointments);

router.route('/appointments/:id')
    .get(canAccessAppointment, getAppointmentDetails);

router.put('/appointments/:id/complete', canAccessAppointment, completeAppointment);
router.put('/appointments/:id/confirm', canAccessAppointment, confirmAppointment);
router.put('/appointments/:id/cancel', canAccessAppointment, cancelAppointmentDoctor);
router.put('/appointments/:id/status', canAccessAppointment, updateAppointmentStatus);

router.get('/patients', getPatients);
router.get('/patients/:id', canAccessPatientData, getPatientProfileForDoctor);
router.get('/patients/:id/history', canAccessPatientData, getPatientProfileForDoctor);

router.route('/prescriptions')
    .get(getPrescriptions)
    .post(idempotent(), canWritePrescription, createPrescription);

router.get('/mr-meetings', getMRMeetings);
router.post('/mr-meetings/:id/approve', canAccessMRMeeting, approveMRMeeting);
router.post('/mr-meetings/:id/reject', canAccessMRMeeting, rejectMRMeeting);

router.get('/analytics', getDoctorAnalytics);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/ratings', getRatingAnalytics);
router.get('/analytics/appointments', getAppointmentTrends);

router.get('/earnings', getEarnings);
router.post('/earnings/withdraw', requestWithdrawal);
router.get('/earnings/history', getEarningsHistory);

router.post('/profile/verify', submitVerificationDocuments);

module.exports = router;