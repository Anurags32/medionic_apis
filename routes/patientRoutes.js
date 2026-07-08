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
    getAvailableSlots,
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
    deleteEmergencyContact,
    getPatientDashboard,
    getFamilyMembers,
    addFamilyMember
} = require('../controllers/patientExtendedController');

const { payAppointment } = require('../controllers/paymentController');

// Import middleware
const upload = require('../services/uploadService');
const { protect, authorize, profileComplete } = require('../middleware/auth');
const { canAccessPatientData, canAccessAppointment, canAccessPrescription, canModifyAppointment } = require('../middleware/roleAuth');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');

// All routes are protected and require patient role
router.use(protect, authorize(constants.ROLES.PATIENT), profileComplete);

// Patient dashboard route
router.get('/dashboard', getPatientDashboard);

// Family members routes
router.route('/family-members')
    .get(getFamilyMembers)
    .post(addFamilyMember);

// Patient profile routes
router.route('/profile')
    .get(getProfile)
    .put(validate('updatePatientProfile'), updateProfile);

// Doctor search and details routes
router.get('/doctors', searchDoctors);
router.get('/doctors/:id', getDoctorDetails);
router.get('/doctors/:id/available-slots', getAvailableSlots);
router.get('/doctors/:id/slots', getAvailableSlots);

// Appointment routes
router.route('/appointments')
    .get(getAppointments)
    .post(bookAppointment);

router.route('/appointments/:id')
    .get(canAccessAppointment, getAppointmentDetails)
    .delete(canModifyAppointment, cancelAppointment);

router.put('/appointments/:id/reschedule', canModifyAppointment, rescheduleAppointment);
router.put('/appointments/:id/cancel', canModifyAppointment, cancelAppointment);
router.post('/appointments/:id/pay', canModifyAppointment, payAppointment);

// Prescription routes
router.route('/prescriptions')
    .get(getPrescriptions);

router.get('/prescriptions/:id', canAccessPrescription, getPrescriptionDetails);
router.get('/prescriptions/:id/download', canAccessPrescription, downloadPrescription);
router.get('/prescriptions/:id/pdf', canAccessPrescription, downloadPrescription);

// Medical records routes
router.route('/medical-records')
    .get(getMedicalRecords)
    .post(upload.single('file'), uploadMedicalRecord);

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