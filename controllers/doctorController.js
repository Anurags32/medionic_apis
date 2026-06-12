const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MRMeetings = require('../models/MRMeetings');
const ErrorResponse = require('../utils/errorResponse');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');

// @desc    Get doctor profile
// @route   GET /api/doctors/profile
// @access  Private (Doctor only)
exports.getProfile = async (req, res, next) => {
    try {
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                ...doctor.toObject(),
                experience: doctor.experience,
                displayName: doctor.displayName
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update doctor profile
// @route   PUT /api/doctors/profile
// @access  Private (Doctor only)
exports.updateProfile = async (req, res, next) => {
    try {
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        // Update allowed fields
        const allowedUpdates = [
            'firstName', 'lastName', 'specialization', 'yearsExperience',
            'clinic', 'consultationFee', 'consultationTypes', 'bio',
            'languages', 'education', 'profilePicture'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                doctor[field] = req.body[field];
            }
        });

        await doctor.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: doctor
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctor schedule
// @route   GET /api/doctors/schedule
// @access  Private (Doctor only)
exports.getSchedule = async (req, res, next) => {
    try {
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                availability: doctor.availability,
                holidays: doctor.holidays
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update doctor schedule
// @route   PUT /api/doctors/schedule
// @access  Private (Doctor only)
exports.updateSchedule = async (req, res, next) => {
    try {
        const user = req.user;
        const { availability } = req.body;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        if (availability) {
            doctor.availability = availability;
        }

        await doctor.save();

        res.status(200).json({
            success: true,
            message: 'Schedule updated successfully',
            data: {
                availability: doctor.availability
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctor appointments
// @route   GET /api/doctors/appointments
// @access  Private (Doctor only)
exports.getAppointments = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            status,
            fromDate,
            toDate,
            patientName,
            page = 1,
            limit = 10
        } = req.query;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        // Build query
        const query = { doctorId: doctor._id };

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.appointmentDate = {};
            if (fromDate) query.appointmentDate.$gte = new Date(fromDate);
            if (toDate) query.appointmentDate.$lte = new Date(toDate);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get appointments with patient details
        const appointments = await Appointment.find(query)
            .populate('patientId', 'firstName lastName dob gender bloodGroup emergencyContact')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ appointmentDate: -1, appointmentTime: -1 });

        const total = await Appointment.countDocuments(query);

        // Filter by patient name if provided
        let filteredAppointments = appointments;
        if (patientName) {
            const nameRegex = new RegExp(patientName, 'i');
            filteredAppointments = appointments.filter(appointment => {
                const patient = appointment.patientId;
                return patient && (
                    nameRegex.test(patient.firstName) ||
                    nameRegex.test(patient.lastName) ||
                    nameRegex.test(`${patient.firstName} ${patient.lastName}`)
                );
            });
        }

        // Format response
        const formattedAppointments = filteredAppointments.map(appointment => {
            const patient = appointment.patientId;
            return {
                appointmentId: appointment._id,
                appointmentDate: appointment.formattedDate,
                appointmentTime: appointment.formattedTime,
                consultationType: appointment.consultationType,
                symptoms: appointment.symptoms,
                status: appointment.status,
                amount: appointment.amount,
                patient: patient ? {
                    patientId: patient._id,
                    name: patient.fullName,
                    age: helpers.calculateAge(patient.dob),
                    gender: patient.gender,
                    bloodGroup: patient.bloodGroup,
                    emergencyContact: patient.emergencyContact
                } : null,
                timeUntil: appointment.timeUntil,
                doctorNotes: appointment.doctorNotes,
                diagnosis: appointment.diagnosis
            };
        });

        res.status(200).json({
            success: true,
            data: formattedAppointments,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get appointment details
// @route   GET /api/doctors/appointments/:id
// @access  Private (Doctor only)
exports.getAppointmentDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const appointment = await Appointment.findOne({
            _id: id,
            doctorId: doctor._id
        }).populate('patientId prescriptionId');

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        // Get patient's medical history and prescriptions
        const patient = appointment.patientId;
        const patientPrescriptions = await Prescription.find({
            patientId: patient._id,
            doctorId: doctor._id
        }).sort({ issuedAt: -1 }).limit(5);

        res.status(200).json({
            success: true,
            data: {
                ...appointment.toObject(),
                formattedDate: appointment.formattedDate,
                formattedTime: appointment.formattedTime,
                patientHistory: {
                    medicalHistory: patient.medicalHistory,
                    allergies: patient.allergies,
                    recentPrescriptions: patientPrescriptions
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Complete appointment
// @route   PUT /api/doctors/appointments/:id/complete
// @access  Private (Doctor only)
exports.completeAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { notes, diagnosis, followUpRequired, followUpDate } = req.body;
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const appointment = await Appointment.findOne({
            _id: id,
            doctorId: doctor._id
        });

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        if (appointment.status === constants.APPOINTMENT_STATUS.COMPLETED) {
            return next(new ErrorResponse('Appointment already completed', 400));
        }

        // Mark as completed
        appointment.markAsCompleted(notes, diagnosis);
        appointment.followUpRequired = followUpRequired || false;
        appointment.followUpDate = followUpDate || null;

        await appointment.save();

        res.status(200).json({
            success: true,
            message: 'Appointment completed successfully',
            data: {
                appointmentId: appointment._id,
                status: appointment.status,
                completedAt: appointment.completedAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create prescription
// @route   POST /api/doctors/prescriptions
// @access  Private (Doctor only)
exports.createPrescription = [
    validate('createPrescription'),
    async (req, res, next) => {
        try {
            const user = req.user;
            const {
                patientId,
                appointmentId,
                medicines,
                testRecommendations = [],
                followUpDate,
                notes,
                followUpInstructions,
                validityPeriod = 30
            } = req.body;

            const doctor = await Doctor.findOne({ userId: user._id });

            if (!doctor) {
                return next(new ErrorResponse('Doctor profile not found', 404));
            }

            // Check if doctor is verified
            if (doctor.verificationStatus !== constants.VERIFICATION_STATUS.VERIFIED) {
                return next(new ErrorResponse('Doctor must be verified to write prescriptions', 403));
            }

            // Validate patient
            const patient = await Patient.findById(patientId);
            if (!patient) {
                return next(new ErrorResponse('Patient not found', 404));
            }

            // Validate appointment if provided
            if (appointmentId) {
                const appointment = await Appointment.findOne({
                    _id: appointmentId,
                    doctorId: doctor._id,
                    patientId
                });

                if (!appointment) {
                    return next(new ErrorResponse('Appointment not found', 404));
                }
            }

            // Create prescription
            const prescription = await Prescription.create({
                doctorId: doctor._id,
                patientId,
                appointmentId,
                medicines,
                testRecommendations,
                followUpDate,
                notes,
                followUpInstructions,
                validityPeriod,
                status: constants.PRESCRIPTION_STATUS.ACTIVE
            });

            res.status(201).json({
                success: true,
                message: 'Prescription created successfully',
                data: {
                    prescriptionId: prescription._id,
                    patientName: patient.fullName,
                    medicineCount: prescription.getTotalMedicines(),
                    testCount: prescription.testRecommendations.length,
                    issuedDate: prescription.formattedIssuedDate,
                    expiryDate: prescription.formattedExpiryDate
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Get doctor prescriptions
// @route   GET /api/doctors/prescriptions
// @access  Private (Doctor only)
exports.getPrescriptions = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            status,
            patientName,
            fromDate,
            toDate,
            page = 1,
            limit = 10
        } = req.query;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        // Build query
        const query = { doctorId: doctor._id };

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.issuedAt = {};
            if (fromDate) query.issuedAt.$gte = new Date(fromDate);
            if (toDate) query.issuedAt.$lte = new Date(toDate);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get prescriptions with patient details
        const prescriptions = await Prescription.find(query)
            .populate('patientId', 'firstName lastName dob')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ issuedAt: -1 });

        const total = await Prescription.countDocuments(query);

        // Filter by patient name if provided
        let filteredPrescriptions = prescriptions;
        if (patientName) {
            const nameRegex = new RegExp(patientName, 'i');
            filteredPrescriptions = prescriptions.filter(prescription => {
                const patient = prescription.patientId;
                return patient && (
                    nameRegex.test(patient.firstName) ||
                    nameRegex.test(patient.lastName) ||
                    nameRegex.test(`${patient.firstName} ${patient.lastName}`)
                );
            });
        }

        // Format response
        const formattedPrescriptions = filteredPrescriptions.map(prescription => {
            const patient = prescription.patientId;
            return {
                prescriptionId: prescription._id,
                issuedDate: prescription.formattedIssuedDate,
                expiryDate: prescription.formattedExpiryDate,
                status: prescription.status,
                medicineCount: prescription.getTotalMedicines(),
                testCount: prescription.testRecommendations?.length || 0,
                patient: patient ? {
                    patientId: patient._id,
                    name: patient.fullName,
                    age: helpers.calculateAge(patient.dob)
                } : null,
                isValid: prescription.isValid,
                daysUntilExpiry: prescription.daysUntilExpiry
            };
        });

        res.status(200).json({
            success: true,
            data: formattedPrescriptions,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctor dashboard
// @route   GET /api/doctors/dashboard
// @access  Private (Doctor only)
exports.getDashboard = async (req, res, next) => {
    try {
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        // Get current month start and end
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Get statistics
        const totalPatients = await Patient.countDocuments({
            _id: {
                $in: await Appointment.distinct('patientId', { doctorId: doctor._id })
            }
        });

        const appointmentsThisMonth = await Appointment.countDocuments({
            doctorId: doctor._id,
            appointmentDate: {
                $gte: monthStart,
                $lte: monthEnd
            }
        });

        const completedAppointments = await Appointment.countDocuments({
            doctorId: doctor._id,
            status: constants.APPOINTMENT_STATUS.COMPLETED,
            appointmentDate: {
                $gte: monthStart,
                $lte: monthEnd
            }
        });

        const totalEarnings = completedAppointments * doctor.consultationFee;

        // Get upcoming appointments (next 7 days)
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        const upcomingAppointments = await Appointment.find({
            doctorId: doctor._id,
            appointmentDate: {
                $gte: now,
                $lte: nextWeek
            },
            status: { $in: [constants.APPOINTMENT_STATUS.PENDING, constants.APPOINTMENT_STATUS.CONFIRMED] }
        })
            .populate('patientId', 'firstName lastName')
            .sort({ appointmentDate: 1, appointmentTime: 1 })
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalPatients,
                    appointmentsThisMonth,
                    completedAppointments,
                    avgRating: doctor.rating,
                    totalEarnings,
                    consultationFee: doctor.consultationFee
                },
                upcomingAppointments: upcomingAppointments.map(appointment => ({
                    appointmentId: appointment._id,
                    patientName: appointment.patientId?.fullName || 'Unknown',
                    date: appointment.formattedDate,
                    time: appointment.formattedTime,
                    consultationType: appointment.consultationType,
                    symptoms: appointment.symptoms?.substring(0, 100) + '...'
                })),
                doctor: {
                    name: doctor.fullName,
                    specialization: doctor.specialization,
                    verificationStatus: doctor.verificationStatus,
                    rating: doctor.rating,
                    totalRatings: doctor.totalRatings
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctor patients
// @route   GET /api/doctors/patients
// @access  Private (Doctor only)
exports.getPatients = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            name,
            lastVisit,
            page = 1,
            limit = 10
        } = req.query;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        // Get unique patient IDs from appointments
        const patientIds = await Appointment.distinct('patientId', { doctorId: doctor._id });

        // Build query
        const query = { _id: { $in: patientIds } };

        if (name) {
            const nameRegex = new RegExp(name, 'i');
            query.$or = [
                { firstName: nameRegex },
                { lastName: nameRegex }
            ];
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get patients
        const patients = await Patient.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ firstName: 1 });

        const total = await Patient.countDocuments(query);

        // Get last appointment for each patient
        const patientsWithLastVisit = await Promise.all(
            patients.map(async (patient) => {
                const lastAppointment = await Appointment.findOne({
                    patientId: patient._id,
                    doctorId: doctor._id
                }).sort({ appointmentDate: -1 });

                const appointmentCount = await Appointment.countDocuments({
                    patientId: patient._id,
                    doctorId: doctor._id
                });

                return {
                    patientId: patient._id,
                    name: patient.fullName,
                    age: helpers.calculateAge(patient.dob),
                    gender: patient.gender,
                    bloodGroup: patient.bloodGroup,
                    lastVisit: lastAppointment?.formattedDate || 'Never',
                    appointmentCount,
                    emergencyContact: patient.emergencyContact
                };
            })
        );

        res.status(200).json({
            success: true,
            data: patientsWithLastVisit,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get MR meetings
// @route   GET /api/doctors/mr-meetings
// @access  Private (Doctor only)
exports.getMRMeetings = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            status,
            page = 1,
            limit = 10
        } = req.query;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        // Build query
        const query = { doctorId: doctor._id };

        if (status) {
            query.status = status;
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get meetings with MR details
        const meetings = await MRMeetings.find(query)
            .populate('mrId', 'firstName lastName companyName territory')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ proposedDate: -1 });

        const total = await MRMeetings.countDocuments(query);

        // Format response
        const formattedMeetings = meetings.map(meeting => {
            const mr = meeting.mrId;
            return {
                meetingId: meeting._id,
                requestId: meeting.requestId,
                proposedDate: meeting.formattedProposedDate,
                proposedTime: meeting.proposedTime,
                purpose: meeting.purpose,
                status: meeting.status,
                statusColor: meeting.statusColor,
                mr: mr ? {
                    mrId: mr._id,
                    name: mr.fullName,
                    company: mr.companyName,
                    territory: mr.territory
                } : null,
                products: meeting.products,
                timeUntilMeeting: meeting.timeUntilMeeting
            };
        });

        res.status(200).json({
            success: true,
            data: formattedMeetings,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve MR meeting
// @route   POST /api/doctors/mr-meetings/:id/approve
// @access  Private (Doctor only)
exports.approveMRMeeting = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { meetingDate, meetingTime, notes } = req.body;
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const meeting = await MRMeetings.findOne({
            _id: id,
            doctorId: doctor._id
        });

        if (!meeting) {
            return next(new ErrorResponse('Meeting not found', 404));
        }

        if (meeting.status !== constants.MEETING_STATUS.PENDING) {
            return next(new ErrorResponse('Meeting has already been responded to', 400));
        }

        // Approve meeting
        meeting.approve(meetingDate, meetingTime, notes);
        await meeting.save();

        res.status(200).json({
            success: true,
            message: 'Meeting approved successfully',
            data: {
                meetingId: meeting._id,
                status: meeting.status,
                meetingDate: meeting.formattedMeetingDate,
                meetingTime: meeting.meetingTime
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Reject MR meeting
// @route   POST /api/doctors/mr-meetings/:id/reject
// @access  Private (Doctor only)
exports.rejectMRMeeting = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const meeting = await MRMeetings.findOne({
            _id: id,
            doctorId: doctor._id
        });

        if (!meeting) {
            return next(new ErrorResponse('Meeting not found', 404));
        }

        if (meeting.status !== constants.MEETING_STATUS.PENDING) {
            return next(new ErrorResponse('Meeting has already been responded to', 400));
        }

        // Reject meeting
        meeting.reject(reason);
        await meeting.save();

        res.status(200).json({
            success: true,
            message: 'Meeting rejected successfully',
            data: {
                meetingId: meeting._id,
                status: meeting.status
            }
        });
    } catch (error) {
        next(error);
    }
};