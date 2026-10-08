const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const HealthMetric = require('../models/HealthMetric');
const MRMeetings = require('../models/MRMeetings');
const ErrorResponse = require('../utils/errorResponse');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');

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
                firstName: doctor.firstName || user.firstName,
                lastName: doctor.lastName || user.lastName,
                email: user.email,
                phone: user.phone,
                specialization: doctor.specialization,
                licenseNumber: doctor.licenseNumber,
                registrationCouncil: doctor.registrationCouncil,
                qualification: doctor.qualification,
                yearsExperience: doctor.yearsExperience,
                clinic: {
                    name: doctor.clinic.name,
                    address: doctor.clinic.address,
                    city: doctor.clinic.city
                },
                consultationFee: doctor.consultationFee,
                videoFee: doctor.videoFee,
                clinicFee: doctor.clinicFee,
                chatFee: doctor.chatFee,
                homeFee: doctor.homeFee,
                homeVisitFee: doctor.homeVisitFee || doctor.homeFee,
                fees: doctor.fees,
                isOnline: doctor.isOnline !== undefined ? doctor.isOnline : false,
                status: doctor.status || (doctor.isOnline ? 'online' : 'offline'),
                availability: doctor.availabilityStatus || (doctor.isOnline ? 'available' : 'offline'),
                lastOnlineAt: doctor.lastOnlineAt,
                verificationStatus: doctor.verificationStatus,
                bio: doctor.bio,
                profilePhoto: user.profilePhoto || doctor.profilePicture,
                shift: doctor.shift,
                slotDurationMinutes: doctor.slotDurationMinutes
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        let userUpdated = false;
        if (req.body.profilePhoto !== undefined) {
            user.profilePhoto = req.body.profilePhoto;
            doctor.profilePicture = req.body.profilePhoto;
            userUpdated = true;
        }
        if (userUpdated) {
            await user.save();
        }

        if (req.body.specialization !== undefined) {
            doctor.specialization = req.body.specialization;
        }
        if (req.body.clinic !== undefined) {
            if (typeof req.body.clinic === 'object') {
                const existing =
                    doctor.clinic && typeof doctor.clinic.toObject === 'function'
                        ? doctor.clinic.toObject()
                        : (doctor.clinic || {});
                const merged = { ...existing, ...req.body.clinic };
                if (merged.coordinates === undefined || merged.coordinates === null) {
                    merged.coordinates = existing.coordinates || {
                        latitude: 0,
                        longitude: 0,
                    };
                }
                doctor.clinic = merged;
            }
        }
        if (req.body.consultationFee !== undefined) {
            doctor.consultationFee = Number(req.body.consultationFee);
        }
        if (req.body.videoFee !== undefined) {
            doctor.videoFee = Number(req.body.videoFee);
        }
        if (req.body.clinicFee !== undefined) {
            doctor.clinicFee = Number(req.body.clinicFee);
        }
        if (req.body.chatFee !== undefined) {
            doctor.chatFee = Number(req.body.chatFee);
        }
        if (req.body.homeFee !== undefined) {
            doctor.homeFee = Number(req.body.homeFee);
        }
        if (req.body.homeVisitFee !== undefined) {
            doctor.homeVisitFee = Number(req.body.homeVisitFee);
            if (req.body.homeFee === undefined) {
                doctor.homeFee = Number(req.body.homeVisitFee);
            }
        } else if (req.body.homeFee !== undefined && doctor.homeVisitFee === undefined) {
            doctor.homeVisitFee = Number(req.body.homeFee);
        }
        if (req.body.fees) {
            const currentFees = (doctor.fees && typeof doctor.fees.toObject === 'function')
                ? doctor.fees.toObject()
                : (doctor.fees || {});
            const mergedFees = { ...currentFees, ...req.body.fees };
            if (mergedFees.homeVisit !== undefined && mergedFees.home === undefined) {
                mergedFees.home = Number(mergedFees.homeVisit);
            }
            if (mergedFees.home !== undefined && mergedFees.homeVisit === undefined) {
                mergedFees.homeVisit = Number(mergedFees.home);
            }
            doctor.fees = mergedFees;
        }

        let statusChanged = false;
        if (req.body.isOnline !== undefined) {
            doctor.isOnline = Boolean(req.body.isOnline);
            doctor.status = doctor.isOnline ? 'online' : 'offline';
            if (doctor.isOnline) {
                doctor.lastOnlineAt = new Date();
            }
            statusChanged = true;
        }
        if (req.body.status !== undefined) {
            doctor.status = req.body.status;
            doctor.isOnline = req.body.status === 'online';
            if (doctor.isOnline) {
                doctor.lastOnlineAt = new Date();
            }
            statusChanged = true;
        }
        if (req.body.availability !== undefined) {
            if (typeof req.body.availability === 'string') {
                doctor.availabilityStatus = req.body.availability;
            }
        }
        if (req.body.bio !== undefined) {
            doctor.bio = req.body.bio;
        }
        if (req.body.shift !== undefined) {
            let parsedShift = req.body.shift;
            if (typeof parsedShift === 'string') {
                try { parsedShift = JSON.parse(parsedShift); } catch (e) { }
            }
            doctor.shift = parsedShift;
        }
        if (req.body.slotDurationMinutes !== undefined) {
            doctor.slotDurationMinutes = req.body.slotDurationMinutes;
        }
        if (req.body.consultationTypes !== undefined) {
            let types = req.body.consultationTypes;
            if (typeof types === 'string') {
                try { types = JSON.parse(types); } catch (e) { types = [types]; }
            }
            if (Array.isArray(types)) {
                const validTypes = Object.values(constants.CONSULTATION_TYPES);
                doctor.consultationTypes = types.filter(t => validTypes.includes(String(t).toLowerCase()));
            }
        }

        await doctor.save();

        // Broadcast real-time status update via Socket.IO
        try {
            const socketModule = require('../socket');
            const ioInstance = socketModule.getIO ? socketModule.getIO() : null;
            if (ioInstance) {
                ioInstance.emit('doctor_status_updated', {
                    doctorId: doctor._id.toString(),
                    userId: user._id.toString(),
                    fullName: doctor.fullName || `${doctor.firstName} ${doctor.lastName}`,
                    isOnline: doctor.isOnline !== undefined ? doctor.isOnline : false,
                    status: doctor.status || (doctor.isOnline ? 'online' : 'offline'),
                    availability: doctor.availabilityStatus || (doctor.isOnline ? 'available' : 'offline'),
                    fees: doctor.fees,
                    homeVisitFee: doctor.homeVisitFee || doctor.homeFee,
                    timestamp: new Date()
                });
            }
        } catch (socketErr) {
            // Ignore if socket not initialized
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                firstName: doctor.firstName || user.firstName,
                lastName: doctor.lastName || user.lastName,
                email: user.email,
                phone: user.phone,
                specialization: doctor.specialization,
                licenseNumber: doctor.licenseNumber,
                registrationCouncil: doctor.registrationCouncil,
                qualification: doctor.qualification,
                yearsExperience: doctor.yearsExperience,
                clinic: {
                    name: doctor.clinic.name,
                    address: doctor.clinic.address,
                    city: doctor.clinic.city
                },
                consultationFee: doctor.consultationFee,
                videoFee: doctor.videoFee,
                clinicFee: doctor.clinicFee,
                chatFee: doctor.chatFee,
                homeFee: doctor.homeFee,
                homeVisitFee: doctor.homeVisitFee || doctor.homeFee,
                fees: doctor.fees,
                isOnline: doctor.isOnline !== undefined ? doctor.isOnline : false,
                status: doctor.status || (doctor.isOnline ? 'online' : 'offline'),
                availability: doctor.availabilityStatus || (doctor.isOnline ? 'available' : 'offline'),
                lastOnlineAt: doctor.lastOnlineAt,
                verificationStatus: doctor.verificationStatus,
                bio: doctor.bio,
                profilePhoto: user.profilePhoto || doctor.profilePicture,
                shift: doctor.shift,
                slotDurationMinutes: doctor.slotDurationMinutes,
                consultationTypes: doctor.consultationTypes
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateDoctorStatus = async (req, res, next) => {
    try {
        const user = req.user;
        const doctor = await Doctor.findOne({ userId: user._id });
        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const { isOnline, status, availability } = req.body;
        if (isOnline !== undefined) {
            doctor.isOnline = Boolean(isOnline);
            doctor.status = doctor.isOnline ? 'online' : 'offline';
        }
        if (status !== undefined) {
            doctor.status = status;
            doctor.isOnline = status === 'online';
        }
        if (availability !== undefined && typeof availability === 'string') {
            doctor.availabilityStatus = availability;
        }
        if (doctor.isOnline) {
            doctor.lastOnlineAt = new Date();
        }

        await doctor.save();

        // Broadcast real-time status update via Socket.IO
        try {
            const socketModule = require('../socket');
            const ioInstance = socketModule.getIO ? socketModule.getIO() : null;
            if (ioInstance) {
                ioInstance.emit('doctor_status_updated', {
                    doctorId: doctor._id.toString(),
                    userId: user._id.toString(),
                    fullName: doctor.fullName || `${doctor.firstName} ${doctor.lastName}`,
                    isOnline: doctor.isOnline,
                    status: doctor.status,
                    availability: doctor.availabilityStatus || (doctor.isOnline ? 'available' : 'offline'),
                    timestamp: new Date()
                });
            }
        } catch (socketErr) {
            // Ignore if socket not initialized
        }

        res.status(200).json({
            success: true,
            message: `Doctor status updated to ${doctor.status}`,
            data: {
                doctorId: doctor._id,
                userId: user._id,
                isOnline: doctor.isOnline,
                status: doctor.status,
                availability: doctor.availabilityStatus || (doctor.isOnline ? 'available' : 'offline'),
                lastOnlineAt: doctor.lastOnlineAt
            }
        });
    } catch (error) {
        next(error);
    }
};

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

        const query = { doctorId: doctor._id };

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.appointmentDate = {};
            if (fromDate) query.appointmentDate.$gte = new Date(fromDate);
            if (toDate) query.appointmentDate.$lte = new Date(toDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const isUpcomingQuery = status && [constants.APPOINTMENT_STATUS.PENDING, constants.APPOINTMENT_STATUS.CONFIRMED].includes(status);
        const sortOptions = isUpcomingQuery
            ? { appointmentDate: 1, appointmentTime: 1 }
            : { appointmentDate: -1, appointmentTime: -1 };

        const appointments = await Appointment.find(query)
            .populate('patientId', 'firstName lastName dob gender bloodGroup emergencyContact')
            .skip(skip)
            .limit(parseInt(limit))
            .sort(sortOptions);

        const total = await Appointment.countDocuments(query);

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
                roomId: appointment.roomId || null,
                meetingId: appointment.meetingId || null,
                consultationLink: appointment.consultationLink || null,
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
        const patient = appointment.patientId;
        const patientPrescriptions = await Prescription.find({
            patientId: patient._id,
            doctorId: doctor._id
        }).sort({ issuedAt: -1 }).limit(5);
        const [healthMetrics, medicalRecords] = await Promise.all([
            HealthMetric.find({ patientId: patient._id })
                .sort({ timestamp: -1 })
                .limit(20)
                .lean(),
            MedicalRecord.find({ patientId: patient._id })
                .sort({ uploadedAt: -1 })
                .limit(20)
                .lean()
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...appointment.toObject(),
                formattedDate: appointment.formattedDate,
                formattedTime: appointment.formattedTime,
                roomId: appointment.roomId || null,
                meetingId: appointment.meetingId || null,
                consultationLink: appointment.consultationLink || null,
                patientHistory: {
                    patient: {
                        patientId: patient._id,
                        name: patient.fullName,
                        dateOfBirth: patient.dob || null,
                        gender: patient.gender || null,
                        bloodGroup: patient.bloodGroup || null,
                        address: patient.address || null
                    },
                    medicalHistory: patient.medicalHistory,
                    allergies: patient.allergies,
                    recentPrescriptions: patientPrescriptions,
                    vitals: healthMetrics,
                    labReports: medicalRecords.filter(record =>
                        ['lab_report', 'test_result'].includes(record.recordType)
                    ),
                    medicalRecords: [
                        ...(patient.medicalRecords || []).map(record => record.toObject()),
                        ...medicalRecords
                    ]
                }
            }
        });
    } catch (error) {
        next(error);
    }
};


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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const apptDate = new Date(appointment.appointmentDate);
        apptDate.setHours(0, 0, 0, 0);
        if (apptDate > today) {
            return next(new ErrorResponse('Cannot mark a future appointment as completed', 400));
        }

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

exports.createPrescription = [
    validate('createPrescription'),
    async (req, res, next) => {
        try {
            const user = req.user;
            const {
                patientId,
                appointmentId,
                diagnosis,
                instructions,
                medicines: rawMedicines,
                testRecommendations = [],
                followUpDate,
                notes,
                followUpInstructions,
                validityPeriod = 30
            } = req.body;

            const medicines = (rawMedicines || []).map(m => ({
                medicineName: m.medicineName || m.name || 'Unknown',
                genericName: m.genericName || '',
                dosage: m.dosage || '',
                frequency: m.frequency || m.timing || '',
                duration: String(m.duration || ''),
                quantity: m.quantity || 1,
                instructions: m.instructions || '',
                beforeMeal: m.beforeMeal || false,
                withFood: m.withFood || false
            }));

            const doctor = await Doctor.findOne({ userId: user._id });

            if (!doctor) {
                return next(new ErrorResponse('Doctor profile not found', 404));
            }

            if (doctor.verificationStatus !== constants.VERIFICATION_STATUS.VERIFIED) {
                return next(new ErrorResponse('Doctor must be verified to write prescriptions', 403));
            }

            const patient = await Patient.findById(patientId);
            if (!patient) {
                return next(new ErrorResponse('Patient not found', 404));
            }

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

            const prescription = await Prescription.create({
                doctorId: doctor._id,
                patientId,
                appointmentId,
                diagnosis,
                medicines,
                instructions,
                testRecommendations,
                followUpDate,
                notes,
                followUpInstructions,
                validityPeriod,
                status: constants.PRESCRIPTION_STATUS.ACTIVE
            });

            if (appointmentId) {
                await Appointment.findByIdAndUpdate(appointmentId, {
                    prescriptionId: prescription._id
                });
            }

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

exports.getPrescriptions = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            patientId,
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


        const query = { doctorId: doctor._id };

        if (patientId) {
            query.patientId = patientId;
        }

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.issuedAt = {};
            if (fromDate) query.issuedAt.$gte = new Date(fromDate);
            if (toDate) query.issuedAt.$lte = new Date(toDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const prescriptions = await Prescription.find(query)
            .populate('patientId', 'firstName lastName dob')
            .populate('appointmentId', 'appointmentDate')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ issuedAt: -1 });

        const total = await Prescription.countDocuments(query);

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

        const formattedPrescriptions = filteredPrescriptions.map(prescription => {
            const patient = prescription.patientId;
            const appointment = prescription.appointmentId;
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
                appointmentDate: appointment ? appointment.appointmentDate : null,
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

exports.getDashboard = async (req, res, next) => {
    try {
        const user = req.user;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

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

        const totalEarningsResult = await Appointment.aggregate([
            {
                $match: {
                    doctorId: doctor._id,
                    status: constants.APPOINTMENT_STATUS.COMPLETED
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        const totalEarnings = totalEarningsResult.length > 0 ? totalEarningsResult[0].total : 0;
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const nextWeek = new Date(todayStart);
        nextWeek.setDate(todayStart.getDate() + 7);

        const upcomingAppointments = await Appointment.find({
            doctorId: doctor._id,
            appointmentDate: {
                $gte: todayStart,
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
                    symptoms: appointment.symptoms?.substring(0, 100) + '...',
                    status: appointment.status
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

exports.getPatients = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            search,
            name,
            lastVisit,
            page = 1,
            limit = 10
        } = req.query;

        const doctor = await Doctor.findOne({ userId: user._id });

        if (!doctor) {
            return next(new ErrorResponse('Doctor profile not found', 404));
        }

        const patientIds = await Appointment.distinct('patientId', { doctorId: doctor._id });

        const query = { _id: { $in: patientIds } };

        const searchQuery = search || name;
        if (searchQuery) {
            const nameRegex = new RegExp(searchQuery, 'i');
            query.$or = [
                { firstName: nameRegex },
                { lastName: nameRegex }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const patients = await Patient.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ firstName: 1 });

        const total = await Patient.countDocuments(query);

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

        const query = { doctorId: doctor._id };

        if (status) {
            query.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const meetings = await MRMeetings.find(query)
            .populate('mrId', 'firstName lastName companyName territory')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ proposedDate: -1 });

        const total = await MRMeetings.countDocuments(query);

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

exports.confirmAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const appointment = await Appointment.findById(id);

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        if (appointment.status !== constants.APPOINTMENT_STATUS.PENDING) {
            return next(new ErrorResponse(`Cannot confirm appointment with status ${appointment.status}`, 400));
        }

        appointment.status = constants.APPOINTMENT_STATUS.CONFIRMED;
        await appointment.save();

        const notificationService = require('../utils/notificationService');
        await notificationService.sendNotification({
            type: 'appointment_confirmed',
            userId: appointment.patientId,
            message: `Your appointment has been confirmed for ${appointment.appointmentDate.toLocaleDateString()} at ${appointment.appointmentTime}.`
        });

        res.status(200).json({
            success: true,
            message: 'Appointment confirmed successfully',
            data: appointment
        });
    } catch (error) {
        next(error);
    }
};


exports.cancelAppointmentDoctor = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const appointment = await Appointment.findById(id);

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        if (appointment.status === constants.APPOINTMENT_STATUS.COMPLETED || appointment.status === constants.APPOINTMENT_STATUS.CANCELLED) {
            return next(new ErrorResponse(`Cannot cancel a ${appointment.status} appointment`, 400));
        }

        appointment.status = constants.APPOINTMENT_STATUS.CANCELLED;
        appointment.cancelledBy = 'doctor';
        appointment.cancellationReason = reason || 'Doctor unavailable';
        await appointment.save();

        const notificationService = require('../utils/notificationService');
        await notificationService.sendNotification({
            type: 'appointment_cancelled',
            userId: appointment.patientId,
            message: `Your appointment has been cancelled by the doctor. Reason: ${appointment.cancellationReason}`
        });

        res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully',
            data: appointment
        });
    } catch (error) {
        next(error);
    }
};

exports.getPatientProfileForDoctor = async (req, res, next) => {
    try {
        const { id } = req.params;

        const patient = await Patient.findById(id).populate('userId', 'email');
        if (!patient) {
            return next(new ErrorResponse('Patient not found', 404));
        }

        const [appointments, prescriptions, vitals, medicalRecords] = await Promise.all([
            Appointment.find({ patientId: patient._id })
                .sort({ appointmentDate: -1, appointmentTime: -1 })
                .lean(),
            Prescription.find({ patientId: patient._id })
                .sort({ issuedAt: -1 })
                .limit(20)
                .lean(),
            HealthMetric.find({ patientId: patient._id })
                .sort({ timestamp: -1 })
                .limit(20)
                .lean(),
            MedicalRecord.find({ patientId: patient._id })
                .sort({ uploadedAt: -1 })
                .limit(20)
                .lean()
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...patient.toObject(),
                appointments,
                prescriptions,
                vitals,
                medicalRecords: [
                    ...(patient.medicalRecords || []).map(record => record.toObject()),
                    ...medicalRecords
                ]
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateAppointmentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const allowedStatuses = [
            constants.APPOINTMENT_STATUS.CONFIRMED,
            constants.APPOINTMENT_STATUS.CANCELLED,
            constants.APPOINTMENT_STATUS.COMPLETED
        ];

        if (!status || !allowedStatuses.includes(status)) {
            return next(new ErrorResponse(`status must be one of: ${allowedStatuses.join(', ')}`, 400));
        }

        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        const Doctor = require('../models/Doctor');
        const doctor = await Doctor.findOne({ userId: req.user._id });
        if (!doctor || appointment.doctorId.toString() !== doctor._id.toString()) {
            return next(new ErrorResponse('Not authorized to update this appointment', 403));
        }

        if (appointment.status === constants.APPOINTMENT_STATUS.COMPLETED ||
            appointment.status === constants.APPOINTMENT_STATUS.CANCELLED) {
            return next(new ErrorResponse(`Cannot update a ${appointment.status} appointment`, 400));
        }

        if (status === constants.APPOINTMENT_STATUS.COMPLETED) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const apptDate = new Date(appointment.appointmentDate);
            apptDate.setHours(0, 0, 0, 0);
            if (apptDate > today) {
                return next(new ErrorResponse('Cannot mark a future appointment as completed', 400));
            }
        }

        appointment.status = status;
        if (reason) {
            if (status === constants.APPOINTMENT_STATUS.CANCELLED) {
                appointment.cancellationReason = reason;
                appointment.cancelledBy = 'doctor';
            } else {
                appointment.doctorNotes = reason;
            }
        }

        await appointment.save();

        res.status(200).json({
            success: true,
            message: `Appointment status updated to ${status}`,
            data: appointment
        });
    } catch (error) {
        next(error);
    }
};
