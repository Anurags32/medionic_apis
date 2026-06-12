const Prescription = require('../models/Prescription');
const PharmacyOrder = require('../models/PharmacyOrder');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const ErrorResponse = require('../utils/errorResponse');
const constants = require('../config/constants');

// @desc    Reschedule appointment
// @route   PUT /api/patients/appointments/:id/reschedule
// @access  Private/Patient
exports.rescheduleAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newDate, newTime } = req.body;

        if (!newDate || !newTime) {
            return next(new ErrorResponse('New date and time are required', 400));
        }

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        if (appointment.patientId.toString() !== req.user._id.toString()) {
            return next(new ErrorResponse('Not authorized to reschedule this appointment', 403));
        }

        if (appointment.status === constants.APPOINTMENT_STATUS.COMPLETED ||
            appointment.status === constants.APPOINTMENT_STATUS.CANCELLED) {
            return next(new ErrorResponse(`Cannot reschedule ${appointment.status} appointment`, 400));
        }

        appointment.appointmentDate = newDate;
        appointment.appointmentTime = newTime;
        appointment.status = constants.APPOINTMENT_STATUS.PENDING;
        await appointment.save();

        res.status(200).json({
            success: true,
            message: 'Appointment rescheduled successfully',
            data: appointment
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Download prescription as PDF
// @route   GET /api/patients/prescriptions/:id/download
// @access  Private/Patient
exports.downloadPrescription = async (req, res, next) => {
    try {
        const { id } = req.params;

        const prescription = await Prescription.findById(id)
            .populate('doctorId', 'firstName lastName specialization clinic')
            .populate('patientId', 'firstName lastName email');

        if (!prescription) {
            return next(new ErrorResponse('Prescription not found', 404));
        }

        if (prescription.patientId._id.toString() !== req.user._id.toString()) {
            return next(new ErrorResponse('Not authorized to download this prescription', 403));
        }

        // Generate PDF content (mock - in production use library like pdfkit)
        const pdfContent = `
        PRESCRIPTION
        ============
        Doctor: ${prescription.doctorId.firstName} ${prescription.doctorId.lastName}
        Specialization: ${prescription.doctorId.specialization}
        Date: ${new Date(prescription.createdAt).toLocaleDateString()}
        
        Patient: ${prescription.patientId.firstName} ${prescription.patientId.lastName}
        Email: ${prescription.patientId.email}
        
        MEDICINES:
        ${prescription.medicines.map((m, i) =>
            `${i + 1}. ${m.medicineName} - ${m.dosage}, ${m.frequency} for ${m.duration}`
        ).join('\n')}
        
        TESTS RECOMMENDED:
        ${prescription.testRecommendations.map((t, i) =>
            `${i + 1}. ${t.testName} (${t.urgency})`
        ).join('\n')}
        
        Follow-up Date: ${new Date(prescription.followUpDate).toLocaleDateString()}
        Notes: ${prescription.notes}
        `;

        res.set({
            'Content-Type': 'text/plain',
            'Content-Disposition': `attachment; filename="prescription_${id}.txt"`
        });
        res.send(pdfContent);
    } catch (error) {
        next(error);
    }
};

// @desc    Upload medical record
// @route   POST /api/patients/medical-records
// @access  Private/Patient
exports.uploadMedicalRecord = async (req, res, next) => {
    try {
        const { category, description } = req.body;
        const patientId = req.user._id;

        if (!req.file) {
            return next(new ErrorResponse('File is required', 400));
        }

        if (!['lab_report', 'test_result', 'prescription', 'other'].includes(category)) {
            return next(new ErrorResponse('Invalid category', 400));
        }

        // In production, upload to cloud storage (S3, etc)
        const fileUrl = `/uploads/${req.file.filename}`;

        const patient = await Patient.findOne({ userId: patientId });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        if (!patient.medicalRecords) {
            patient.medicalRecords = [];
        }

        const record = {
            _id: new require('mongoose').Types.ObjectId(),
            category,
            description,
            fileUrl,
            fileName: req.file.filename,
            fileSize: req.file.size,
            uploadedAt: new Date()
        };

        patient.medicalRecords.push(record);
        await patient.save();

        res.status(201).json({
            success: true,
            message: 'Medical record uploaded successfully',
            data: record
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get medical records
// @route   GET /api/patients/medical-records
// @access  Private/Patient
exports.getMedicalRecords = async (req, res, next) => {
    try {
        const patientId = req.user._id;
        const { category, limit = 20, skip = 0 } = req.query;

        const patient = await Patient.findOne({ userId: patientId });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        let records = patient.medicalRecords || [];

        if (category) {
            records = records.filter(r => r.category === category);
        }

        // Sort by latest first
        records = records.sort((a, b) => b.uploadedAt - a.uploadedAt);

        const total = records.length;
        records = records.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Medical records retrieved successfully',
            data: {
                total,
                count: records.length,
                records
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete medical record
// @route   DELETE /api/patients/medical-records/:id
// @access  Private/Patient
exports.deleteMedicalRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const patientId = req.user._id;

        const patient = await Patient.findOne({ userId: patientId });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const recordIndex = patient.medicalRecords.findIndex(r => r._id.toString() === id);
        if (recordIndex === -1) {
            return next(new ErrorResponse('Medical record not found', 404));
        }

        patient.medicalRecords.splice(recordIndex, 1);
        await patient.save();

        res.status(200).json({
            success: true,
            message: 'Medical record deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Add emergency contact
// @route   POST /api/patients/emergency-contacts
// @access  Private/Patient
exports.addEmergencyContact = async (req, res, next) => {
    try {
        const { name, phone, relation, email } = req.body;
        const patientId = req.user._id;

        if (!name || !phone || !relation) {
            return next(new ErrorResponse('Name, phone, and relation are required', 400));
        }

        const patient = await Patient.findOne({ userId: patientId });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        if (!patient.emergencyContacts) {
            patient.emergencyContacts = [];
        }

        const contact = {
            _id: new require('mongoose').Types.ObjectId(),
            name,
            phone,
            relation,
            email,
            createdAt: new Date()
        };

        patient.emergencyContacts.push(contact);
        await patient.save();

        res.status(201).json({
            success: true,
            message: 'Emergency contact added successfully',
            data: contact
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete emergency contact
// @route   DELETE /api/patients/emergency-contacts/:id
// @access  Private/Patient
exports.deleteEmergencyContact = async (req, res, next) => {
    try {
        const { id } = req.params;
        const patientId = req.user._id;

        const patient = await Patient.findOne({ userId: patientId });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const contactIndex = patient.emergencyContacts.findIndex(c => c._id.toString() === id);
        if (contactIndex === -1) {
            return next(new ErrorResponse('Emergency contact not found', 404));
        }

        patient.emergencyContacts.splice(contactIndex, 1);
        await patient.save();

        res.status(200).json({
            success: true,
            message: 'Emergency contact deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
