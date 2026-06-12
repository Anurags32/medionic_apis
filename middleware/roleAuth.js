const ErrorResponse = require('../utils/errorResponse');
const constants = require('../config/constants');

// Middleware to check if user has access to patient data
exports.canAccessPatientData = async (req, res, next) => {
    try {
        const { patientId } = req.params;
        const user = req.user;

        if (!user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        // Admin can access all patient data
        if (user.role === constants.ROLES.ADMIN) {
            return next();
        }

        // Patient can access their own data
        if (user.role === constants.ROLES.PATIENT) {
            // Check if patient is accessing their own data
            // This assumes the patient ID in params matches the logged-in patient's ID
            // In practice, you'd need to check the patient document linked to the user
            const Patient = require('../models/Patient');
            const patient = await Patient.findOne({ userId: user._id });

            if (patient && patient._id.toString() === patientId) {
                return next();
            }
        }

        // Doctor can access data of their patients
        if (user.role === constants.ROLES.DOCTOR) {
            // Check if this patient has appointments with this doctor
            const Appointment = require('../models/Appointment');
            const hasAppointment = await Appointment.findOne({
                patientId,
                doctorId: req.user.doctorId // Assuming doctorId is populated
            });

            if (hasAppointment) {
                return next();
            }
        }

        // MR cannot access patient data
        return next(new ErrorResponse('Not authorized to access this patient data', 403));
    } catch (error) {
        return next(new ErrorResponse('Error checking access permissions', 500));
    }
};

// Middleware to check if user has access to doctor data
exports.canAccessDoctorData = async (req, res, next) => {
    try {
        const { doctorId } = req.params;
        const user = req.user;

        if (!user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        // Admin can access all doctor data
        if (user.role === constants.ROLES.ADMIN) {
            return next();
        }

        // Doctor can access their own data
        if (user.role === constants.ROLES.DOCTOR) {
            // Check if doctor is accessing their own data
            const Doctor = require('../models/Doctor');
            const doctor = await Doctor.findOne({ userId: user._id });

            if (doctor && doctor._id.toString() === doctorId) {
                return next();
            }
        }

        // MR can access doctor data in their territory
        if (user.role === constants.ROLES.MR) {
            // Check if this doctor is in MR's territory
            const Doctor = require('../models/Doctor');
            const MedicalRep = require('../models/MedicalRep');

            const doctor = await Doctor.findById(doctorId);
            const mr = await MedicalRep.findOne({ userId: user._id });

            if (doctor && mr && doctor.clinic.city === mr.territory) {
                return next();
            }
        }

        // Patient can access doctor data for booking appointments
        if (user.role === constants.ROLES.PATIENT) {
            // Patients can view doctor profiles for booking
            return next();
        }

        return next(new ErrorResponse('Not authorized to access this doctor data', 403));
    } catch (error) {
        return next(new ErrorResponse('Error checking access permissions', 500));
    }
};

// Middleware to check if user can access appointment
exports.canAccessAppointment = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const user = req.user;

        if (!user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        // Admin can access all appointments
        if (user.role === constants.ROLES.ADMIN) {
            return next();
        }

        const Appointment = require('../models/Appointment');
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        // Patient can access their own appointments
        if (user.role === constants.ROLES.PATIENT) {
            const Patient = require('../models/Patient');
            const patient = await Patient.findOne({ userId: user._id });

            if (patient && appointment.patientId.toString() === patient._id.toString()) {
                return next();
            }
        }

        // Doctor can access appointments where they are the doctor
        if (user.role === constants.ROLES.DOCTOR) {
            const Doctor = require('../models/Doctor');
            const doctor = await Doctor.findOne({ userId: user._id });

            if (doctor && appointment.doctorId.toString() === doctor._id.toString()) {
                return next();
            }
        }

        return next(new ErrorResponse('Not authorized to access this appointment', 403));
    } catch (error) {
        return next(new ErrorResponse('Error checking access permissions', 500));
    }
};

// Middleware to check if user can access prescription
exports.canAccessPrescription = async (req, res, next) => {
    try {
        const { prescriptionId } = req.params;
        const user = req.user;

        if (!user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        // Admin can access all prescriptions
        if (user.role === constants.ROLES.ADMIN) {
            return next();
        }

        const Prescription = require('../models/Prescription');
        const prescription = await Prescription.findById(prescriptionId);

        if (!prescription) {
            return next(new ErrorResponse('Prescription not found', 404));
        }

        // Patient can access their own prescriptions
        if (user.role === constants.ROLES.PATIENT) {
            const Patient = require('../models/Patient');
            const patient = await Patient.findOne({ userId: user._id });

            if (patient && prescription.patientId.toString() === patient._id.toString()) {
                return next();
            }
        }

        // Doctor can access prescriptions they wrote
        if (user.role === constants.ROLES.DOCTOR) {
            const Doctor = require('../models/Doctor');
            const doctor = await Doctor.findOne({ userId: user._id });

            if (doctor && prescription.doctorId.toString() === doctor._id.toString()) {
                return next();
            }
        }

        return next(new ErrorResponse('Not authorized to access this prescription', 403));
    } catch (error) {
        return next(new ErrorResponse('Error checking access permissions', 500));
    }
};

// Middleware to check if user can modify appointment
exports.canModifyAppointment = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const user = req.user;

        if (!user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        const Appointment = require('../models/Appointment');
        const appointment = await Appointment.findById(appointmentId);

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        // Check if appointment can be modified
        if (!appointment.canBeRescheduled() && req.method !== 'DELETE') {
            return next(new ErrorResponse('Appointment cannot be rescheduled', 400));
        }

        if (!appointment.canBeCancelled() && req.method === 'DELETE') {
            return next(new ErrorResponse('Appointment cannot be cancelled', 400));
        }

        // Patient can modify their own appointments
        if (user.role === constants.ROLES.PATIENT) {
            const Patient = require('../models/Patient');
            const patient = await Patient.findOne({ userId: user._id });

            if (patient && appointment.patientId.toString() === patient._id.toString()) {
                return next();
            }
        }

        // Doctor can modify their own appointments
        if (user.role === constants.ROLES.DOCTOR) {
            const Doctor = require('../models/Doctor');
            const doctor = await Doctor.findOne({ userId: user._id });

            if (doctor && appointment.doctorId.toString() === doctor._id.toString()) {
                return next();
            }
        }

        return next(new ErrorResponse('Not authorized to modify this appointment', 403));
    } catch (error) {
        return next(new ErrorResponse('Error checking modification permissions', 500));
    }
};

// Middleware to check if user can write prescription
exports.canWritePrescription = async (req, res, next) => {
    try {
        const user = req.user;

        if (!user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        // Only doctors can write prescriptions
        if (user.role !== constants.ROLES.DOCTOR) {
            return next(new ErrorResponse('Only doctors can write prescriptions', 403));
        }

        // Check if doctor has completed profile
        const Doctor = require('../models/Doctor');
        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        // Check if doctor is verified
        if (doctor.verificationStatus !== constants.VERIFICATION_STATUS.VERIFIED) {
            return next(new ErrorResponse('Doctor must be verified to write prescriptions', 403));
        }

        next();
    } catch (error) {
        return next(new ErrorResponse('Error checking prescription permissions', 500));
    }
};

// Middleware to check if user can access MR meeting
exports.canAccessMRMeeting = async (req, res, next) => {
    try {
        const { meetingId } = req.params;
        const user = req.user;

        if (!user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        // Admin can access all MR meetings
        if (user.role === constants.ROLES.ADMIN) {
            return next();
        }

        const MRMeetings = require('../models/MRMeetings');
        const meeting = await MRMeetings.findById(meetingId);

        if (!meeting) {
            return next(new ErrorResponse('Meeting not found', 404));
        }

        // MR can access their own meetings
        if (user.role === constants.ROLES.MR) {
            const MedicalRep = require('../models/MedicalRep');
            const mr = await MedicalRep.findOne({ userId: user._id });

            if (mr && meeting.mrId.toString() === mr._id.toString()) {
                return next();
            }
        }

        // Doctor can access meetings with them
        if (user.role === constants.ROLES.DOCTOR) {
            const Doctor = require('../models/Doctor');
            const doctor = await Doctor.findOne({ userId: user._id });

            if (doctor && meeting.doctorId.toString() === doctor._id.toString()) {
                return next();
            }
        }

        return next(new ErrorResponse('Not authorized to access this meeting', 403));
    } catch (error) {
        return next(new ErrorResponse('Error checking access permissions', 500));
    }
};