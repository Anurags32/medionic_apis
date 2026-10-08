const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const PharmacyOrder = require('../models/PharmacyOrder');
const HealthMetric = require('../models/HealthMetric');
const ErrorResponse = require('../utils/errorResponse');
const { validate } = require('../middleware/validation');
const constants = require('../config/constants');
const helpers = require('../utils/helpers');

exports.getProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const patient = await Patient.findOne({ userId: user._id });

        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                firstName: patient.firstName || user.firstName,
                lastName: patient.lastName || user.lastName,
                email: user.email,
                phone: user.phone,
                dob: patient.dob,
                gender: patient.gender,
                address: patient.address,
                bloodGroup: patient.bloodGroup,
                emergencyContact: patient.emergencyContact,
                medicalHistory: patient.medicalHistory,
                allergies: patient.allergies,
                profilePhoto: user.profilePhoto || patient.profilePicture
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const user = req.user;
        const patient = await Patient.findOne({ userId: user._id });

        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }
        let userUpdated = false;
        if (req.body.firstName !== undefined) {
            user.firstName = req.body.firstName;
            patient.firstName = req.body.firstName;
            userUpdated = true;
        }
        if (req.body.lastName !== undefined) {
            user.lastName = req.body.lastName;
            patient.lastName = req.body.lastName;
            userUpdated = true;
        }
        if (req.body.phone !== undefined) {
            user.phone = req.body.phone;
            userUpdated = true;
        }
        if (req.body.profilePhoto !== undefined) {
            user.profilePhoto = req.body.profilePhoto;
            patient.profilePicture = req.body.profilePhoto;
            userUpdated = true;
        }
        if (userUpdated) {
            await user.save();
        }
        if (req.body.dob !== undefined) {
            patient.dob = helpers.normalizeDob(req.body.dob);
        }
        if (req.body.gender !== undefined) {
            patient.gender = req.body.gender;
        }
        if (req.body.address !== undefined) {
            patient.address = helpers.parseAddress(req.body.address);
        }
        if (req.body.bloodGroup !== undefined) {
            patient.bloodGroup = req.body.bloodGroup;
        }
        if (req.body.emergencyContact !== undefined) {
            let parsedEmergencyContact = req.body.emergencyContact;
            if (typeof parsedEmergencyContact === 'string') {
                parsedEmergencyContact = {
                    name: 'Emergency Contact',
                    phone: parsedEmergencyContact,
                    relation: 'Contact'
                };
            }
            patient.emergencyContact = parsedEmergencyContact;
        }
        if (req.body.medicalHistory !== undefined) {
            patient.medicalHistory = req.body.medicalHistory;
        }
        if (req.body.allergies !== undefined) {
            patient.allergies = req.body.allergies;
        }

        await patient.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                firstName: patient.firstName || user.firstName,
                lastName: patient.lastName || user.lastName,
                email: user.email,
                phone: user.phone,
                dob: patient.dob,
                gender: patient.gender,
                address: patient.address,
                bloodGroup: patient.bloodGroup,
                emergencyContact: patient.emergencyContact,
                medicalHistory: patient.medicalHistory,
                allergies: patient.allergies,
                profilePhoto: user.profilePhoto || patient.profilePicture
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.searchDoctors = async (req, res, next) => {
    try {
        const {
            specialization,
            city,
            minRating = 0,
            maxFee,
            consultationType,
            page = 1,
            limit = 10,
            search
        } = req.query;

        const query = {};

        if (specialization) {
            query.specialization = { $regex: specialization, $options: 'i' };
        }

        if (city) {
            query['clinic.city'] = { $regex: city, $options: 'i' };
        }

        if (minRating) {
            query.rating = { $gte: parseFloat(minRating) };
        }

        if (maxFee) {
            query.consultationFee = { $lte: parseFloat(maxFee) };
        }

        if (consultationType) {
            query.consultationTypes = { $in: [consultationType, constants.CONSULTATION_TYPES.CLINIC] };
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { specialization: searchRegex },
                { 'clinic.name': searchRegex },
                { 'clinic.city': searchRegex }
            ];
        }

        query.verificationStatus = constants.VERIFICATION_STATUS.VERIFIED;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const doctors = await Doctor.find(query)
            .select('-certificates -verificationDocuments -availability -holidays')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ rating: -1, consultationFee: 1 });

        const total = await Doctor.countDocuments(query);

        const formattedDoctors = doctors.map(doctor => {
            const rawTypes = Array.isArray(doctor.consultationTypes) && doctor.consultationTypes.length > 0
                ? doctor.consultationTypes
                : Object.values(constants.CONSULTATION_TYPES);
            const isLegacyClinicOnly = rawTypes.length === 1 && rawTypes[0] === constants.CONSULTATION_TYPES.CLINIC;
            const effectiveModes = isLegacyClinicOnly ? Object.values(constants.CONSULTATION_TYPES) : rawTypes;

            const isVideoAvailable = effectiveModes.includes(constants.CONSULTATION_TYPES.VIDEO);
            const isClinicAvailable = effectiveModes.includes(constants.CONSULTATION_TYPES.CLINIC);
            const isChatAvailable = effectiveModes.includes(constants.CONSULTATION_TYPES.CHAT);
            const isHomeAvailable = effectiveModes.includes(constants.CONSULTATION_TYPES.HOME) ||
                                     effectiveModes.includes(constants.CONSULTATION_TYPES.HOME_VISIT) ||
                                     effectiveModes.includes('home') ||
                                     effectiveModes.includes('home_visit');

            return {
                doctorId: doctor._id,
                fullName: doctor.fullName,
                specialization: doctor.specialization,
                qualification: doctor.qualification,
                yearsExperience: doctor.yearsExperience,
                clinic: doctor.clinic,
                verificationStatus: doctor.verificationStatus,
                isOnline: doctor.isOnline !== undefined ? doctor.isOnline : false,
                status: doctor.status || (doctor.isOnline ? 'online' : 'offline'),
                availability: doctor.availabilityStatus || (doctor.isOnline ? 'available' : 'offline'),
                lastOnlineAt: doctor.lastOnlineAt,
                consultationFee: doctor.consultationFee,
                videoFee: doctor.videoFee,
                clinicFee: doctor.clinicFee,
                chatFee: doctor.chatFee,
                homeFee: doctor.homeFee,
                homeVisitFee: doctor.homeVisitFee || doctor.homeFee,
                fees: doctor.fees,
                supportedModes: effectiveModes,
                pricing: {
                    currency: 'INR',
                    video: {
                        feeMinor: isVideoAvailable
                            ? Math.round((doctor.videoFee || doctor.fees?.video || doctor.consultationFee || 500) * 100)
                            : null,
                        available: isVideoAvailable
                    },
                    inClinic: {
                        feeMinor: isClinicAvailable
                            ? Math.round((doctor.clinicFee || doctor.fees?.clinic || doctor.consultationFee || 600) * 100)
                            : null,
                        available: isClinicAvailable
                    },
                    chat: {
                        feeMinor: isChatAvailable
                            ? Math.round((doctor.chatFee || doctor.fees?.chat || doctor.consultationFee || 300) * 100)
                            : null,
                        available: isChatAvailable
                    },
                    homeVisit: {
                        feeMinor: Math.round((doctor.homeVisitFee || doctor.homeFee || doctor.fees?.homeVisit || doctor.fees?.home || 750) * 100),
                        available: isHomeAvailable
                    }
                },
                rating: doctor.totalRatings > 0 ? doctor.rating : null,
                totalReviews: doctor.totalRatings || 0,
                bio: doctor.bio?.substring(0, 200) + (doctor.bio?.length > 200 ? '...' : '')
            };
        });

        res.status(200).json({
            success: true,
            data: formattedDoctors,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.getDoctorDetails = async (req, res, next) => {
    try {
        const { id } = req.params;

        const doctor = await Doctor.findById(id)
            .select('-certificates -verificationDocuments');

        if (!doctor) {
            return next(new ErrorResponse('Doctor not found', 404));
        }

        if (doctor.verificationStatus !== constants.VERIFICATION_STATUS.VERIFIED) {
            return next(new ErrorResponse('Doctor not verified', 404));
        }

        const availability = {};
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dayName = days[date.getDay()];

            if (doctor.availability[dayName] && doctor.availability[dayName].length > 0) {
                availability[dayName] = {
                    date: date.toISOString().split('T')[0],
                    slots: doctor.availability[dayName]
                };
            }
        }

        res.status(200).json({
            success: true,
            data: {
                ...doctor.toObject(),
                experience: doctor.experience,
                availability
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.bookAppointment = [
    validate('bookAppointment'),
    async (req, res, next) => {
        try {
            const user = req.user;
            const {
                doctorId,
                appointmentDate,
                appointmentTime,
                consultationType,
                symptoms
            } = req.body;


            const patient = await Patient.findOne({ userId: user._id });
            if (!patient) {
                return next(new ErrorResponse('Patient profile not found', 404));
            }

            const doctor = await Doctor.findById(doctorId);
            if (!doctor) {
                return next(new ErrorResponse('Doctor not found', 404));
            }

            if (doctor.verificationStatus !== constants.VERIFICATION_STATUS.VERIFIED) {
                return next(new ErrorResponse('Doctor not verified', 400));
            }

            const normalizedConsultationType = String(consultationType || '').toLowerCase();
            if (!Object.values(constants.CONSULTATION_TYPES).includes(normalizedConsultationType)) {
                return next(new ErrorResponse('Invalid consultation type', 400));
            }

            const rawConsultationTypes = Array.isArray(doctor.consultationTypes) && doctor.consultationTypes.length > 0
                ? doctor.consultationTypes
                : Object.values(constants.CONSULTATION_TYPES);
            const isLegacyClinicOnly = rawConsultationTypes.length === 1 && rawConsultationTypes[0] === constants.CONSULTATION_TYPES.CLINIC;
            const effectiveConsultationTypes = isLegacyClinicOnly
                ? Object.values(constants.CONSULTATION_TYPES)
                : rawConsultationTypes;

            if (!effectiveConsultationTypes.includes(normalizedConsultationType)) {
                return next(new ErrorResponse('Doctor does not support this consultation type', 400));
            }

            const appointmentDateTime = new Date(appointmentDate);
            if (Number.isNaN(appointmentDateTime.getTime())) {
                return next(new ErrorResponse('A valid appointment date is required', 400));
            }
            if (!doctor.isAvailable(appointmentDateTime, appointmentTime)) {
                return next(new ErrorResponse('Doctor not available at this time', 400));
            }

            const startOfDay = new Date(appointmentDateTime);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(appointmentDateTime);
            endOfDay.setHours(23, 59, 59, 999);

            const existingAppointment = await Appointment.findOne({
                doctorId,
                appointmentDate: { $gte: startOfDay, $lte: endOfDay },
                appointmentTime,
                status: { $in: ['pending', 'confirmed'] }
            });

            if (existingAppointment) {
                return next(new ErrorResponse('Time slot already booked', 409));
            }

            let appointmentAmount = doctor.consultationFee;
            if (normalizedConsultationType === constants.CONSULTATION_TYPES.VIDEO) {
                appointmentAmount = doctor.videoFee || doctor.consultationFee;
            } else if (normalizedConsultationType === constants.CONSULTATION_TYPES.CLINIC) {
                appointmentAmount = doctor.clinicFee || doctor.consultationFee;
            } else if (normalizedConsultationType === constants.CONSULTATION_TYPES.CHAT) {
                appointmentAmount = doctor.chatFee || doctor.consultationFee;
            } else if (['home', 'home_visit', 'homevisit'].includes(normalizedConsultationType)) {
                appointmentAmount = doctor.homeVisitFee || doctor.homeFee || doctor.fees?.homeVisit || doctor.fees?.home || doctor.consultationFee;
            }

            const appointment = await Appointment.create({
                patientId: patient._id,
                doctorId,
                appointmentDate: appointmentDateTime,
                appointmentTime,
                consultationType: normalizedConsultationType,
                symptoms,
                status: constants.APPOINTMENT_STATUS.PENDING,
                amount: appointmentAmount
            });

            res.status(201).json({
                success: true,
                message: 'Appointment booked successfully',
                data: {
                    appointmentId: appointment._id,
                    appointmentDate: appointment.formattedDate,
                    appointmentTime: appointment.formattedTime,
                    doctorName: doctor.fullName,
                    consultationType: appointment.consultationType,
                    symptoms,
                    status: appointment.status,
                    amount: appointment.amount,
                    roomId: appointment.roomId || null,
                    meetingId: appointment.meetingId || null,
                    consultationLink: appointment.consultationLink || null,
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

exports.getAppointments = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            status,
            fromDate,
            toDate,
            page = 1,
            limit = 10
        } = req.query;

        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const query = { patientId: patient._id };

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.appointmentDate = {};
            if (fromDate) query.appointmentDate.$gte = new Date(fromDate);
            if (toDate) query.appointmentDate.$lte = new Date(toDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const appointments = await Appointment.find(query)
            .populate('doctorId', 'firstName lastName specialization clinic consultationFee videoFee clinicFee chatFee homeFee homeVisitFee fees isOnline status availabilityStatus')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ appointmentDate: -1, appointmentTime: -1 });

        const total = await Appointment.countDocuments(query);

        const formattedAppointments = appointments.map(appointment => {
            const doctor = appointment.doctorId;
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
                doctor: doctor ? {
                    doctorId: doctor._id,
                    name: doctor.fullName,
                    specialization: doctor.specialization,
                    clinic: doctor.clinic
                } : null,
                canBeCancelled: appointment.canBeCancelled(),
                canBeRescheduled: appointment.canBeRescheduled(),
                timeUntil: appointment.timeUntil,
                roomId: appointment.roomId || null,
                meetingId: appointment.meetingId || null,
                consultationLink: appointment.consultationLink || null
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

        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const appointment = await Appointment.findOne({
            _id: id,
            patientId: patient._id
        }).populate('doctorId prescriptionId');

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                ...appointment.toObject(),
                formattedDate: appointment.formattedDate,
                formattedTime: appointment.formattedTime,
                timeUntil: appointment.timeUntil,
                canBeCancelled: appointment.canBeCancelled(),
                canBeRescheduled: appointment.canBeRescheduled(),
                roomId: appointment.roomId || null,
                meetingId: appointment.meetingId || null,
                consultationLink: appointment.consultationLink || null
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.cancelAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }
        const appointment = await Appointment.findOne({
            _id: id,
            patientId: patient._id
        });

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        if (!appointment.canBeCancelled()) {
            return next(new ErrorResponse('Appointment cannot be cancelled', 400));
        }

        appointment.cancel('patient', req.body.reason || 'Patient cancelled');
        await appointment.save();

        res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully'
        });
    } catch (error) {
        next(error);
    }
};

exports.getPrescriptions = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            status,
            fromDate,
            toDate,
            page = 1,
            limit = 10
        } = req.query;

        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const query = { patientId: patient._id };

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
            .populate('doctorId', 'firstName lastName specialization')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ issuedAt: -1 });

        const total = await Prescription.countDocuments(query);

        const formattedPrescriptions = prescriptions.map(prescription => {
            const doctor = prescription.doctorId;
            return {
                prescriptionId: prescription._id,
                issuedDate: prescription.formattedIssuedDate,
                expiryDate: prescription.formattedExpiryDate,
                status: prescription.status,
                medicineCount: prescription.getTotalMedicines(),
                testCount: prescription.testRecommendations?.length || 0,
                doctor: doctor ? {
                    doctorId: doctor._id,
                    name: doctor.fullName,
                    specialization: doctor.specialization
                } : null,
                isValid: prescription.isValid,
                daysUntilExpiry: prescription.daysUntilExpiry,
                remainingRefills: prescription.remainingRefills
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

exports.getPrescriptionDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }
        const prescription = await Prescription.findOne({
            _id: id,
            patientId: patient._id
        }).populate('doctorId appointmentId');

        if (!prescription) {
            return next(new ErrorResponse('Prescription not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                ...prescription.toObject(),
                formattedIssuedDate: prescription.formattedIssuedDate,
                formattedExpiryDate: prescription.formattedExpiryDate,
                isValid: prescription.isValid,
                daysUntilExpiry: prescription.daysUntilExpiry,
                remainingRefills: prescription.remainingRefills,
                medicineNames: prescription.getMedicineNames()
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.createPharmacyOrder = [
    validate('createOrder'),
    async (req, res, next) => {
        try {
            const user = req.user;
            const {
                medicines,
                prescriptionId,
                deliveryAddress,
                paymentMethod
            } = req.body;

            const patient = await Patient.findOne({ userId: user._id });
            if (!patient) {
                return next(new ErrorResponse('Patient profile not found', 404));
            }

            if (prescriptionId) {
                const prescription = await Prescription.findOne({
                    _id: prescriptionId,
                    patientId: patient._id
                });

                if (!prescription) {
                    return next(new ErrorResponse('Prescription not found or not valid', 404));
                }

                if (!prescription.isValid) {
                    return next(new ErrorResponse('Prescription is not valid or has expired', 400));
                }
            }
            const totalAmount = medicines.reduce((total, medicine) => {
                return total + (medicine.price * medicine.quantity);
            }, 0);

            const order = await PharmacyOrder.create({
                patientId: patient._id,
                prescriptionId,
                medicines,
                totalAmount,
                finalAmount: totalAmount,
                paymentMethod,
                deliveryAddress: deliveryAddress || patient.address,
                status: constants.ORDER_STATUS.PENDING
            });

            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                data: {
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    totalAmount: order.totalAmount,
                    finalAmount: order.finalAmount,
                    medicineCount: order.medicineCount,
                    estimatedDelivery: order.formattedDeliveryDate,
                    status: order.status
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

exports.getPharmacyOrders = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            status,
            fromDate,
            toDate,
            page = 1,
            limit = 10
        } = req.query;

        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const query = { patientId: patient._id };

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const orders = await PharmacyOrder.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await PharmacyOrder.countDocuments(query);

        const formattedOrders = orders.map(order => ({
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderDate: order.formattedOrderDate,
            totalAmount: order.totalAmount,
            finalAmount: order.finalAmount,
            medicineCount: order.medicineCount,
            status: order.status,
            statusColor: order.statusColor,
            deliveryProgress: order.deliveryProgress,
            estimatedDelivery: order.formattedDeliveryDate,
            timeUntilDelivery: order.timeUntilDelivery,
            canBeCancelled: order.canBeCancelled()
        }));

        res.status(200).json({
            success: true,
            data: formattedOrders,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

exports.logHealthMetric = [
    validate('logHealthMetric'),
    async (req, res, next) => {
        try {
            const user = req.user;
            const {
                metricType,
                value,
                unit,
                timestamp,
                notes,
                source = 'manual'
            } = req.body;

            const patient = await Patient.findOne({ userId: user._id });
            if (!patient) {
                return next(new ErrorResponse('Patient profile not found', 404));
            }

            if (metricType === constants.HEALTH_METRICS.BLOOD_PRESSURE) {
                const validators = require('../utils/validators');
                if (!validators.isValidBloodPressure(value)) {
                    return next(new ErrorResponse('Invalid blood pressure format. Use systolic/diastolic (e.g., 120/80)', 400));
                }
            }

            const healthMetric = await HealthMetric.create({
                patientId: patient._id,
                metricType,
                value,
                unit,
                timestamp: timestamp || new Date(),
                notes,
                source
            });

            res.status(201).json({
                success: true,
                message: 'Health metric logged successfully',
                data: {
                    metricId: healthMetric._id,
                    metricType,
                    formattedValue: healthMetric.formattedValue,
                    timestamp: healthMetric.formattedTimestamp,
                    healthStatus: healthMetric.healthStatus,
                    statusMessage: healthMetric.statusMessage,
                    statusColor: healthMetric.statusColor
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

exports.getHealthMetrics = async (req, res, next) => {
    try {
        const user = req.user;
        const {
            metricType,
            fromDate,
            toDate,
            limit = 50,
            groupBy = 'date'
        } = req.query;

        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const query = { patientId: patient._id };

        if (metricType) {
            query.metricType = metricType;
        }

        if (fromDate || toDate) {
            query.timestamp = {};
            if (fromDate) query.timestamp.$gte = new Date(fromDate);
            if (toDate) query.timestamp.$lte = new Date(toDate);
        }

        const metrics = await HealthMetric.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        const statistics = await HealthMetric.getStatistics(patient._id, metricType);

        const formattedMetrics = metrics.map(metric => ({
            metricId: metric._id,
            metricType: metric.metricType,
            value: metric.value,
            formattedValue: metric.formattedValue,
            unit: metric.unit,
            timestamp: metric.formattedTimestamp,
            date: metric.date,
            time: metric.time,
            healthStatus: metric.healthStatus,
            statusMessage: metric.statusMessage,
            statusColor: metric.statusColor,
            notes: metric.notes,
            source: metric.source
        }));

        res.status(200).json({
            success: true,
            data: {
                metrics: formattedMetrics,
                statistics,
                patient: {
                    patientId: patient._id,
                    fullName: patient.fullName,
                    age: helpers.calculateAge(patient.dob)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getHealthStatistics = async (req, res, next) => {
    try {
        const user = req.user;
        const { days = 30 } = req.query;
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const metricTypes = Object.values(constants.HEALTH_METRICS);
        const statistics = {};

        for (const metricType of metricTypes) {
            const stats = await HealthMetric.getStatistics(patient._id, metricType, parseInt(days));
            if (stats.count > 0) {
                statistics[metricType] = stats;
            }
        }
        const dailyAverages = await HealthMetric.getDailyAverages(patient._id, 'BP', 7);

        res.status(200).json({
            success: true,
            data: {
                statistics,
                dailyAverages,
                patient: {
                    patientId: patient._id,
                    fullName: patient.fullName,
                    age: helpers.calculateAge(patient.dob),
                    bloodGroup: patient.bloodGroup
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.getEmergencyContacts = async (req, res, next) => {
    try {
        const user = req.user;

        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                primaryContact: patient.emergencyContact,
                patientInfo: {
                    fullName: patient.fullName,
                    bloodGroup: patient.bloodGroup,
                    allergies: patient.allergies,
                    medicalHistory: patient.medicalHistory
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

exports.updateEmergencyContact = async (req, res, next) => {
    try {
        const user = req.user;
        const { name, phone, relation } = req.body;
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        const validators = require('../utils/validators');
        if (!validators.isValidPhone(phone)) {
            return next(new ErrorResponse('Invalid phone number', 400));
        }

        patient.emergencyContact = { name, phone, relation };
        await patient.save();

        res.status(200).json({
            success: true,
            message: 'Emergency contact updated successfully',
            data: patient.emergencyContact
        });
    } catch (error) {
        next(error);
    }
};

const generateTimeSlots = (startTimeStr, endTimeStr, slotDuration) => {
    const slots = [];
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);

    let current = new Date();
    current.setHours(startHour, startMinute, 0, 0);

    const end = new Date();
    end.setHours(endHour, endMinute, 0, 0);

    while (true) {
        const nextTime = new Date(current);
        nextTime.setMinutes(current.getMinutes() + slotDuration);
        if (nextTime > end) {
            break;
        }
        const hh = current.getHours().toString().padStart(2, '0');
        const mm = current.getMinutes().toString().padStart(2, '0');
        slots.push(`${hh}:${mm}`);
        current = nextTime;
    }
    return slots;
};

exports.getAvailableSlots = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date } = req.query;

        if (!date) {
            return next(new ErrorResponse('Please provide a date (YYYY-MM-DD)', 400));
        }

        const queryDate = new Date(date);
        if (isNaN(queryDate.getTime())) {
            return next(new ErrorResponse('Invalid date format. Use YYYY-MM-DD', 400));
        }

        const doctor = await Doctor.findById(id);
        if (!doctor) {
            return next(new ErrorResponse('Doctor not found', 404));
        }

        const isHoliday = doctor.holidays && doctor.holidays.some(holiday => {
            const hDate = new Date(holiday.date);
            return hDate.toDateString() === queryDate.toDateString();
        });

        if (isHoliday) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = days[queryDate.getDay()];

        const dayShift = doctor.shift && doctor.shift[dayName] ? doctor.shift[dayName] : [];
        const daySchedule = doctor.schedule && doctor.schedule[dayName] ? doctor.schedule[dayName] : [];
        const dayAvailability = doctor.availability && doctor.availability[dayName] ? doctor.availability[dayName] : [];

        let allSlots = [];
        const duration = doctor.slotDurationMinutes || 10;

        if (dayShift.length > 0) {
            dayShift.forEach(slotRange => {
                if (slotRange.start && slotRange.end) {
                    const generated = generateTimeSlots(slotRange.start, slotRange.end, duration);
                    allSlots = allSlots.concat(generated);
                }
            });
        } else if (daySchedule.length > 0) {
            daySchedule.forEach(slotRange => {
                if (slotRange.start && slotRange.end) {
                    const generated = generateTimeSlots(slotRange.start, slotRange.end, doctor.slotDurationMinutes || 30);
                    allSlots = allSlots.concat(generated);
                }
            });
        } else if (dayAvailability.length > 0) {
            dayAvailability.forEach(slotRange => {
                if (slotRange.startTime && slotRange.endTime) {
                    const generated = generateTimeSlots(slotRange.startTime, slotRange.endTime, doctor.slotDurationMinutes || 30);
                    allSlots = allSlots.concat(generated);
                }
            });
        }

        if (allSlots.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const startOfDay = new Date(queryDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(queryDate);
        endOfDay.setHours(23, 59, 59, 999);

        const bookings = await Appointment.find({
            doctorId: doctor._id,
            appointmentDate: { $gte: startOfDay, $lte: endOfDay },
            status: { $in: [constants.APPOINTMENT_STATUS.PENDING, constants.APPOINTMENT_STATUS.CONFIRMED] }
        });

        const bookedTimes = bookings.map(b => b.appointmentTime);

        const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

        const formattedSlots = availableSlots.map(slot => ({
            time: slot,
            available: true
        }));

        res.status(200).json({
            success: true,
            data: formattedSlots
        });
    } catch (error) {
        next(error);
    }
};

exports.rateAppointment = [
    validate('rateAppointment'),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { rating, feedback } = req.body;
            const user = req.user;

            const patient = await Patient.findOne({ userId: user._id });
            if (!patient) {
                return next(new ErrorResponse('Patient profile not found', 404));
            }

            const appointment = await Appointment.findOne({
                _id: id,
                patientId: patient._id
            });

            if (!appointment) {
                return next(new ErrorResponse('Appointment not found', 404));
            }

            if (appointment.status !== constants.APPOINTMENT_STATUS.COMPLETED) {
                return next(new ErrorResponse('You can only rate a completed appointment', 400));
            }

            appointment.rating = {
                value: rating,
                feedback: feedback || '',
                submittedAt: new Date()
            };

            await appointment.save();

            const doctor = await Doctor.findById(appointment.doctorId);
            if (doctor) {
                doctor.updateRating(rating);
                await doctor.save();
            }

            res.status(200).json({
                success: true,
                message: 'Thank you for your rating and feedback!',
                data: {
                    appointmentId: appointment._id,
                    rating: appointment.rating
                }
            });
        } catch (error) {
            next(error);
        }
    }
];