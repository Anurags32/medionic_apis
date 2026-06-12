const express = require('express');
const router = express.Router();

// Import controller functions
const {
    getProfile,
    updateProfile,
    searchDoctors,
    getDoctorDetails,
    bookAppointment,
    getAppointments,
    getAppointmentDetails,
    cancelAppointment,
    getPrescriptions,
    getPrescriptionDetails,
    createPharmacyOrder,
    getPharmacyOrders,
    logHealthMetric,
    getHealthMetrics,
    getHealthStatistics,
    getEmergencyContacts,
    updateEmergencyContact
} = require('../controllers/patientController');

// Import extended controller functions
const {
    rescheduleAppointment,
    downloadPrescription,
    uploadMedicalRecord,
    getMedicalRecords,
    deleteMedicalRecord,
    addEmergencyContact,
    deleteEmergencyContact
} = require('../controllers/patientExtendedController');

// Import middleware
const { protect, authorize, profileComplete } = require('../middleware/auth');
const { canAccessPatientData, canAccessAppointment, canAccessPrescription, canModifyAppointment } = require('../middleware/roleAuth');
const constants = require('../config/constants');

// All routes are protected and require patient role
router.use(protect, authorize(constants.ROLES.PATIENT), profileComplete);

// Patient profile routes
router.route('/profile')
    .get(getProfile)
    .put(updateProfile);

// Doctor search and details routes
router.get('/doctors', searchDoctors);
router.get('/doctors/:id', getDoctorDetails);

// Appointment routes
router.route('/appointments')
    .get(getAppointments)
    .post(bookAppointment);

router.route('/appointments/:id')
    .get(canAccessAppointment, getAppointmentDetails)
    .delete(canModifyAppointment, cancelAppointment);

router.put('/appointments/:id/reschedule', canModifyAppointment, rescheduleAppointment);

// Prescription routes
router.route('/prescriptions')
    .get(getPrescriptions);

router.get('/prescriptions/:id', canAccessPrescription, getPrescriptionDetails);
router.get('/prescriptions/:id/download', canAccessPrescription, downloadPrescription);

// Medical records routes
router.route('/medical-records')
    .get(getMedicalRecords)
    .post(uploadMedicalRecord);

router.route('/medical-records/:id')
    .delete(deleteMedicalRecord);

// Pharmacy order routes
router.route('/pharmacy-orders')
    .get(getPharmacyOrders)
    .post(createPharmacyOrder);

// Health tracking routes
router.route('/health-tracking')
    .get(getHealthMetrics)
    .post(logHealthMetric);

router.get('/health-tracking/statistics', getHealthStatistics);

// Emergency contact routes
router.route('/emergency-contacts')
    .get(getEmergencyContacts)
    .put(updateEmergencyContact)
    .post(addEmergencyContact);

router.delete('/emergency-contacts/:id', deleteEmergencyContact);

module.exports = router;