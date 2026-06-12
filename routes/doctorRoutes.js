const express = require('express');
const router = express.Router();

// Import controller functions
const {
    getProfile,
    updateProfile,
    getSchedule,
    updateSchedule,
    getAppointments,
    getAppointmentDetails,
    completeAppointment,
    createPrescription,
    getPrescriptions,
    getDashboard,
    getPatients,
    getMRMeetings,
    approveMRMeeting,
    rejectMRMeeting
} = require('../controllers/doctorController');

// Import middleware
const { protect, authorize, profileComplete } = require('../middleware/auth');
const { canAccessDoctorData, canAccessAppointment, canWritePrescription, canAccessMRMeeting } = require('../middleware/roleAuth');
const constants = require('../config/constants');

// All routes are protected and require doctor role
router.use(protect, authorize(constants.ROLES.DOCTOR), profileComplete);

// Doctor profile routes
router.route('/profile')
    .get(getProfile)
    .put(updateProfile);

// Schedule routes
router.route('/schedule')
    .get(getSchedule)
    .put(updateSchedule);

// Dashboard
router.get('/dashboard', getDashboard);

// Appointment routes
router.route('/appointments')
    .get(getAppointments);

router.route('/appointments/:id')
    .get(canAccessAppointment, getAppointmentDetails);

router.put('/appointments/:id/complete', canAccessAppointment, completeAppointment);

// Patient routes
router.get('/patients', getPatients);

// Prescription routes
router.route('/prescriptions')
    .get(getPrescriptions)
    .post(canWritePrescription, createPrescription);

// MR meeting routes
router.get('/mr-meetings', getMRMeetings);
router.post('/mr-meetings/:id/approve', canAccessMRMeeting, approveMRMeeting);
router.post('/mr-meetings/:id/reject', canAccessMRMeeting, rejectMRMeeting);

module.exports = router;