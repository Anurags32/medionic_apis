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

// @desc    Get patient profile
// @route   GET /api/patients/profile
// @access  Private (Patient only)
exports.getProfile = async (req, res, next) => {
    try {
        const user = req.user;

        // Get patient profile
        const patient = await Patient.findOne({ userId: user._id });

        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Calculate age
        const age = helpers.calculateAge(patient.dob);

        res.status(200).json({
            success: true,
            data: {
                ...patient.toObject(),
                age,
                formattedAddress: patient.formattedAddress
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update patient profile
// @route   PUT /api/patients/profile
// @access  Private (Patient only)
exports.updateProfile = async (req, res, next) => {
    try {
        const user = req.user;

        // Find patient
        const patient = await Patient.findOne({ userId: user._id });

        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Update allowed fields
        const allowedUpdates = [
            'firstName', 'lastName', 'dob', 'gender', 'address', 'bloodGroup',
            'emergencyContact', 'medicalHistory', 'allergies', 'insuranceDetails',
            'height', 'weight', 'profilePicture', 'preferences'
        ];

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                patient[field] = req.body[field];
            }
        });

        await patient.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: patient
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Search doctors
// @route   GET /api/patients/doctors
// @access  Private (Patient only)
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

        // Build query
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
            query.consultationTypes = consultationType;
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

        // Only show verified doctors
        query.verificationStatus = constants.VERIFICATION_STATUS.VERIFIED;

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const doctors = await Doctor.find(query)
            .select('-certificates -verificationDocuments -availability -holidays')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ rating: -1, consultationFee: 1 });

        const total = await Doctor.countDocuments(query);

        // Format response
        const formattedDoctors = doctors.map(doctor => ({
            doctorId: doctor._id,
            fullName: doctor.fullName,
            specialization: doctor.specialization,
            experience: doctor.experience,
            clinic: doctor.clinic,
            consultationFee: doctor.consultationFee,
            consultationTypes: doctor.consultationTypes,
            rating: doctor.rating,
            totalRatings: doctor.totalRatings,
            bio: doctor.bio?.substring(0, 200) + (doctor.bio?.length > 200 ? '...' : '')
        }));

        res.status(200).json({
            success: true,
            data: formattedDoctors,
            pagination: helpers.generatePagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get doctor details
// @route   GET /api/patients/doctors/:id
// @access  Private (Patient only)
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

        // Get availability for next 7 days
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

// @desc    Book appointment
// @route   POST /api/patients/appointments
// @access  Private (Patient only)
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

            // Get patient
            const patient = await Patient.findOne({ userId: user._id });
            if (!patient) {
                return next(new ErrorResponse('Patient profile not found', 404));
            }

            // Get doctor
            const doctor = await Doctor.findById(doctorId);
            if (!doctor) {
                return next(new ErrorResponse('Doctor not found', 404));
            }

            if (doctor.verificationStatus !== constants.VERIFICATION_STATUS.VERIFIED) {
                return next(new ErrorResponse('Doctor not verified', 400));
            }

            // Check doctor availability
            const appointmentDateTime = new Date(appointmentDate);
            if (!doctor.isAvailable(appointmentDateTime, appointmentTime)) {
                return next(new ErrorResponse('Doctor not available at this time', 400));
            }

            // Check if appointment slot is already booked
            const existingAppointment = await Appointment.findOne({
                doctorId,
                appointmentDate: appointmentDateTime,
                appointmentTime,
                status: { $in: ['pending', 'confirmed'] }
            });

            if (existingAppointment) {
                return next(new ErrorResponse('Time slot already booked', 400));
            }

            // Create appointment
            const appointment = await Appointment.create({
                patientId: patient._id,
                doctorId,
                appointmentDate: appointmentDateTime,
                appointmentTime,
                consultationType,
                symptoms,
                status: constants.APPOINTMENT_STATUS.PENDING,
                amount: doctor.consultationFee
            });

            res.status(201).json({
                success: true,
                message: 'Appointment booked successfully',
                data: {
                    appointmentId: appointment._id,
                    appointmentDate: appointment.formattedDate,
                    appointmentTime: appointment.formattedTime,
                    doctorName: doctor.fullName,
                    consultationType,
                    symptoms,
                    status: appointment.status,
                    amount: appointment.amount
                }
            });
        } catch (error) {
            next(error);
        }
    }
];

// @desc    Get patient appointments
// @route   GET /api/patients/appointments
// @access  Private (Patient only)
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

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Build query
        const query = { patientId: patient._id };

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

        // Get appointments with doctor details
        const appointments = await Appointment.find(query)
            .populate('doctorId', 'firstName lastName specialization clinic consultationFee')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ appointmentDate: -1, appointmentTime: -1 });

        const total = await Appointment.countDocuments(query);

        // Format response
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
                doctor: doctor ? {
                    doctorId: doctor._id,
                    name: doctor.fullName,
                    specialization: doctor.specialization,
                    clinic: doctor.clinic
                } : null,
                canBeCancelled: appointment.canBeCancelled(),
                canBeRescheduled: appointment.canBeRescheduled(),
                timeUntil: appointment.timeUntil
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
// @route   GET /api/patients/appointments/:id
// @access  Private (Patient only)
exports.getAppointmentDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Get appointment
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
                canBeRescheduled: appointment.canBeRescheduled()
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Cancel appointment
// @route   DELETE /api/patients/appointments/:id
// @access  Private (Patient only)
exports.cancelAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Get appointment
        const appointment = await Appointment.findOne({
            _id: id,
            patientId: patient._id
        });

        if (!appointment) {
            return next(new ErrorResponse('Appointment not found', 404));
        }

        // Check if appointment can be cancelled
        if (!appointment.canBeCancelled()) {
            return next(new ErrorResponse('Appointment cannot be cancelled', 400));
        }

        // Cancel appointment
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

// @desc    Get patient prescriptions
// @route   GET /api/patients/prescriptions
// @access  Private (Patient only)
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

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Build query
        const query = { patientId: patient._id };

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

        // Get prescriptions with doctor details
        const prescriptions = await Prescription.find(query)
            .populate('doctorId', 'firstName lastName specialization')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ issuedAt: -1 });

        const total = await Prescription.countDocuments(query);

        // Format response
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

// @desc    Get prescription details
// @route   GET /api/patients/prescriptions/:id
// @access  Private (Patient only)
exports.getPrescriptionDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Get prescription
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

// @desc    Create pharmacy order
// @route   POST /api/patients/pharmacy-orders
// @access  Private (Patient only)
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

            // Get patient
            const patient = await Patient.findOne({ userId: user._id });
            if (!patient) {
                return next(new ErrorResponse('Patient profile not found', 404));
            }

            // Validate prescription if provided
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

            // Calculate total amount
            const totalAmount = medicines.reduce((total, medicine) => {
                return total + (medicine.price * medicine.quantity);
            }, 0);

            // Create order
            const order = await PharmacyOrder.create({
                patientId: patient._id,
                prescriptionId,
                medicines,
                totalAmount,
                finalAmount: totalAmount, // No discount or tax for now
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

// @desc    Get patient orders
// @route   GET /api/patients/pharmacy-orders
// @access  Private (Patient only)
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

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Build query
        const query = { patientId: patient._id };

        if (status) {
            query.status = status;
        }

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get orders
        const orders = await PharmacyOrder.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await PharmacyOrder.countDocuments(query);

        // Format response
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

// @desc    Log health metric
// @route   POST /api/patients/health-tracking
// @access  Private (Patient only)
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

            // Get patient
            const patient = await Patient.findOne({ userId: user._id });
            if (!patient) {
                return next(new ErrorResponse('Patient profile not found', 404));
            }

            // Validate blood pressure format
            if (metricType === constants.HEALTH_METRICS.BLOOD_PRESSURE) {
                const validators = require('../utils/validators');
                if (!validators.isValidBloodPressure(value)) {
                    return next(new ErrorResponse('Invalid blood pressure format. Use systolic/diastolic (e.g., 120/80)', 400));
                }
            }

            // Create health metric
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

// @desc    Get health metrics
// @route   GET /api/patients/health-tracking
// @access  Private (Patient only)
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

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Build query
        const query = { patientId: patient._id };

        if (metricType) {
            query.metricType = metricType;
        }

        if (fromDate || toDate) {
            query.timestamp = {};
            if (fromDate) query.timestamp.$gte = new Date(fromDate);
            if (toDate) query.timestamp.$lte = new Date(toDate);
        }

        // Get metrics
        const metrics = await HealthMetric.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        // Get statistics
        const statistics = await HealthMetric.getStatistics(patient._id, metricType);

        // Format response
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

// @desc    Get health statistics
// @route   GET /api/patients/health-tracking/statistics
// @access  Private (Patient only)
exports.getHealthStatistics = async (req, res, next) => {
    try {
        const user = req.user;
        const { days = 30 } = req.query;

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Get statistics for each metric type
        const metricTypes = Object.values(constants.HEALTH_METRICS);
        const statistics = {};

        for (const metricType of metricTypes) {
            const stats = await HealthMetric.getStatistics(patient._id, metricType, parseInt(days));
            if (stats.count > 0) {
                statistics[metricType] = stats;
            }
        }

        // Get daily averages for trends
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

// @desc    Get emergency contacts
// @route   GET /api/patients/emergency-contacts
// @access  Private (Patient only)
exports.getEmergencyContacts = async (req, res, next) => {
    try {
        const user = req.user;

        // Get patient
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

// @desc    Update emergency contact
// @route   PUT /api/patients/emergency-contacts
// @access  Private (Patient only)
exports.updateEmergencyContact = async (req, res, next) => {
    try {
        const user = req.user;
        const { name, phone, relation } = req.body;

        // Get patient
        const patient = await Patient.findOne({ userId: user._id });
        if (!patient) {
            return next(new ErrorResponse('Patient profile not found', 404));
        }

        // Validate phone
        const validators = require('../utils/validators');
        if (!validators.isValidPhone(phone)) {
            return next(new ErrorResponse('Invalid phone number', 400));
        }

        // Update emergency contact
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