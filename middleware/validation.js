const Joi = require('joi');
const ErrorResponse = require('../utils/errorResponse');

const validateShift = (value, helpers) => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeToMinutes = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    for (const day of days) {
        const ranges = value[day] || [];
        const parsedRanges = [];
        
        for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            if (!range.start || !range.end) continue;
            const startMins = timeToMinutes(range.start);
            const endMins = timeToMinutes(range.end);
            
            if (endMins <= startMins) {
                return helpers.message(`On ${day}, end time (${range.end}) must be strictly after start time (${range.start})`);
            }
            parsedRanges.push({ start: startMins, end: endMins, index: i });
        }

        // Sort ranges by start time
        parsedRanges.sort((a, b) => a.start - b.start);
        
        for (let i = 0; i < parsedRanges.length - 1; i++) {
            if (parsedRanges[i].end > parsedRanges[i + 1].start) {
                const overlapStartStr = ranges[parsedRanges[i].index].start;
                const overlapEndStr = ranges[parsedRanges[i].index].end;
                const nextStartStr = ranges[parsedRanges[i + 1].index].start;
                const nextEndStr = ranges[parsedRanges[i + 1].index].end;
                return helpers.message(`On ${day}, shift ranges overlap between ${overlapStartStr}-${overlapEndStr} and ${nextStartStr}-${nextEndStr}`);
            }
        }
    }
    return value;
};

const shiftTimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const shiftDaySchema = Joi.array().items(
    Joi.object({
        start: Joi.string().pattern(shiftTimeRegex).required().messages({
            'string.pattern.base': 'Start time must be a valid 24-hour time string in HH:mm format'
        }),
        end: Joi.string().pattern(shiftTimeRegex).required().messages({
            'string.pattern.base': 'End time must be a valid 24-hour time string in HH:mm format'
        })
    })
).default([]);

const shiftSchema = Joi.object({
    monday: shiftDaySchema,
    tuesday: shiftDaySchema,
    wednesday: shiftDaySchema,
    thursday: shiftDaySchema,
    friday: shiftDaySchema,
    saturday: shiftDaySchema,
    sunday: shiftDaySchema
}).unknown(false).custom(validateShift).messages({
    'object.unknown': 'Day keys must only be lowercase monday through sunday'
});

// Validation schemas
const schemas = {
    // Auth validation
    register: Joi.object({
        email: Joi.string().pattern(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).required().messages({
            'string.pattern.base': 'Please provide a valid email',
            'any.required': 'Email is required'
        }),
        password: Joi.string()
            .min(8)
            .pattern(/^(?=.*[A-Z])(?=.*\d)/)
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter and one number',
                'any.required': 'Password is required'
            }),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Confirm password is required'
        }),
        role: Joi.string().valid('patient', 'doctor', 'mr', 'admin').required().messages({
            'any.only': 'Role must be one of: patient, doctor, mr, admin',
            'any.required': 'Role is required'
        })
    }),

    patientRegister: Joi.object({
        fullName: Joi.string().required(),
        email: Joi.string().pattern(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).required().messages({
            'string.pattern.base': 'Please provide a valid email',
            'any.required': 'Email is required'
        }),
        password: Joi.string()
            .min(8)
            .pattern(/^(?=.*[A-Z])(?=.*\d)/)
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter and one number',
                'any.required': 'Password is required'
            }),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Confirm password is required'
        }),
        phone: Joi.string().pattern(/^\d{10}$/).required().messages({
            'string.pattern.base': 'Phone number must be exactly 10 digits',
            'any.required': 'Phone number is required'
        }),
        dob: Joi.string().required().messages({
            'any.required': 'Date of birth is required'
        }),
        gender: Joi.string().valid('Male', 'Female', 'Other', 'male', 'female', 'other').required().messages({
            'any.required': 'Gender is required'
        }),
        address: Joi.string().required().messages({
            'any.required': 'Address is required'
        }),
        bloodGroup: Joi.string().allow('', null),
        emergencyPhone: Joi.string().pattern(/^\d{10}$/).required().messages({
            'string.pattern.base': 'Emergency phone number must be exactly 10 digits',
            'any.required': 'Emergency phone is required'
        }),
        medicalConditions: Joi.string().allow('', null)
    }),

    doctorRegister: Joi.object({
        fullName: Joi.string().required(),
        email: Joi.string().pattern(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).required(),
        password: Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*\d)/).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        phone: Joi.string().pattern(/^\d{10}$/).required(),
        licenseNumber: Joi.string().required(),
        registrationCouncil: Joi.string().required(),
        qualification: Joi.string().required(),
        specialization: Joi.string().required(),
        yearsExperience: Joi.any().required(),
        clinicName: Joi.string().required(),
        clinicAddress: Joi.string().required(),
        city: Joi.string().allow('', null),
        consultationFee: Joi.any().allow('', null),
        shift: shiftSchema.optional(),
        slotDurationMinutes: Joi.number().integer().min(1).optional()
    }),

    mrRegister: Joi.object({
        fullName: Joi.string().required(),
        email: Joi.string().pattern(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).required(),
        password: Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*\d)/).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        phone: Joi.string().pattern(/^\d{10}$/).required(),
        companyName: Joi.string().required(),
        employeeId: Joi.string().required(),
        designation: Joi.string().required(),
        territory: Joi.string().required()
    }),

    login: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email',
            'any.required': 'Email is required'
        }),
        password: Joi.string().required().messages({
            'any.required': 'Password is required'
        })
    }),

    // Profile completion validation
    patientProfile: Joi.object({
        firstName: Joi.string().max(50),
        lastName: Joi.string().max(50),
        fullName: Joi.string().max(100),
        dob: Joi.any().required().messages({
            'any.required': 'Date of birth is required'
        }),
        gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').required().messages({
            'any.only': 'Gender must be one of: male, female, other, prefer-not-to-say',
            'any.required': 'Gender is required'
        }),
        address: Joi.alternatives().try(
            Joi.string(),
            Joi.object({
                street: Joi.string().required().messages({ 'any.required': 'Street is required' }),
                city: Joi.string().required().messages({ 'any.required': 'City is required' }),
                state: Joi.string().required().messages({ 'any.required': 'State is required' }),
                zip: Joi.string().pattern(/^\d{5,6}(-\d{4})?$/).required().messages({
                    'string.pattern.base': 'Please provide a valid ZIP code',
                    'any.required': 'ZIP code is required'
                })
            })
        ).required().messages({
            'any.required': 'Address is required'
        }),
        bloodGroup: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'),
        emergencyContact: Joi.alternatives().try(
            Joi.object({
                name: Joi.string().required().messages({ 'any.required': 'Emergency contact name is required' }),
                phone: Joi.string().required().messages({ 'any.required': 'Emergency contact phone is required' }),
                relation: Joi.string().required().messages({ 'any.required': 'Emergency contact relation is required' })
            }),
            Joi.string()
        ).required().messages({
            'any.required': 'Emergency contact info is required'
        }),
        emergencyPhone: Joi.string(),
        medicalConditions: Joi.any(),
        medicalHistory: Joi.array(),
        allergies: Joi.array()
    }),

    doctorProfile: Joi.object({
        firstName: Joi.string().max(50),
        lastName: Joi.string().max(50),
        fullName: Joi.string().max(100),
        specialization: Joi.string().required().messages({
            'any.required': 'Specialization is required'
        }),
        licenseNumber: Joi.string().required().messages({
            'any.required': 'License number is required'
        }),
        yearsExperience: Joi.number().min(0).required().messages({
            'number.min': 'Years of experience cannot be negative',
            'any.required': 'Years of experience is required'
        }),
        clinic: Joi.alternatives().try(
            Joi.string(),
            Joi.object({
                name: Joi.string().required().messages({ 'any.required': 'Clinic name is required' }),
                address: Joi.string().required().messages({ 'any.required': 'Clinic address is required' }),
                city: Joi.string().required().messages({ 'any.required': 'Clinic city is required' }),
                phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
                    'string.pattern.base': 'Please provide a valid phone number',
                    'any.required': 'Clinic phone is required'
                })
            })
        ).required().messages({
            'any.required': 'Clinic details are required'
        }),
        consultationFee: Joi.number().min(0).required().messages({
            'number.min': 'Consultation fee cannot be negative',
            'any.required': 'Consultation fee is required'
        }),
        bio: Joi.string().allow('', null),
        schedule: Joi.object().allow(null),
        slotDurationMinutes: Joi.number().integer().min(5).default(30)
    }),

    mrProfile: Joi.object({
        firstName: Joi.string().max(50),
        lastName: Joi.string().max(50),
        fullName: Joi.string().max(100),
        phone: Joi.string(),
        companyName: Joi.string().required().messages({
            'any.required': 'Company name is required'
        }),
        territory: Joi.string().required().messages({
            'any.required': 'Territory is required'
        }),
        designation: Joi.string().required().messages({
            'any.required': 'Designation is required'
        }),
        employeeId: Joi.string()
    }),

    // Appointment validation
    bookAppointment: Joi.object({
        doctorId: Joi.string().required().messages({
            'any.required': 'Doctor ID is required'
        }),
        appointmentDate: Joi.date().required().messages({
            'date.base': 'Appointment date must be a valid date',
            'any.required': 'Appointment date is required'
        }),
        appointmentTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
            'string.pattern.base': 'Appointment time must be in HH:MM format',
            'any.required': 'Appointment time is required'
        }),
        consultationType: Joi.string().valid('video', 'chat', 'clinic').required().messages({
            'any.only': 'Consultation type must be one of: video, chat, clinic',
            'any.required': 'Consultation type is required'
        }),
        symptoms: Joi.string().max(500).required().messages({
            'string.max': 'Symptoms cannot exceed 500 characters',
            'any.required': 'Symptoms description is required'
        })
    }),

    // Prescription validation
    createPrescription: Joi.object({
        patientId: Joi.string().required().messages({
            'any.required': 'Patient ID is required'
        }),
        appointmentId: Joi.string().required().messages({
            'any.required': 'Appointment ID is required'
        }),
        medicines: Joi.array().items(
            Joi.object({
                medicineName: Joi.string().required().messages({
                    'any.required': 'Medicine name is required'
                }),
                dosage: Joi.string().required().messages({
                    'any.required': 'Dosage is required'
                }),
                frequency: Joi.string().required().messages({
                    'any.required': 'Frequency is required'
                }),
                duration: Joi.string().required().messages({
                    'any.required': 'Duration is required'
                }),
                quantity: Joi.number().min(1).required().messages({
                    'number.min': 'Quantity must be at least 1',
                    'any.required': 'Quantity is required'
                })
            })
        ).min(1).required().messages({
            'array.min': 'At least one medicine is required',
            'any.required': 'Medicines are required'
        }),
        testRecommendations: Joi.array().items(Joi.string()).optional(),
        followUpDate: Joi.date().iso().allow('', null).optional(),
        notes: Joi.string().allow('', null).optional(),
        followUpInstructions: Joi.string().allow('', null).optional(),
        validityPeriod: Joi.number().integer().min(1).optional()
    }),

    // Pharmacy order validation
    createOrder: Joi.object({
        medicines: Joi.array().items(
            Joi.object({
                medicineName: Joi.string().required().messages({
                    'any.required': 'Medicine name is required'
                }),
                quantity: Joi.number().min(1).required().messages({
                    'number.min': 'Quantity must be at least 1',
                    'any.required': 'Quantity is required'
                }),
                price: Joi.number().min(0).required().messages({
                    'number.min': 'Price cannot be negative',
                    'any.required': 'Price is required'
                })
            })
        ).min(1).required().messages({
            'array.min': 'At least one medicine is required',
            'any.required': 'Medicines are required'
        }),
        deliveryAddress: Joi.object({
            street: Joi.string().required().messages({
                'any.required': 'Street address is required'
            }),
            city: Joi.string().required().messages({
                'any.required': 'City is required'
            }),
            state: Joi.string().required().messages({
                'any.required': 'State is required'
            }),
            zip: Joi.string().pattern(/^\d{5,6}(-\d{4})?$/).required().messages({
                'string.pattern.base': 'Please provide a valid ZIP code',
                'any.required': 'ZIP code is required'
            }),
            contactPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
                'string.pattern.base': 'Please provide a valid phone number',
                'any.required': 'Contact phone is required'
            })
        }).required(),
        paymentMethod: Joi.string().valid('COD', 'Card', 'UPI').required().messages({
            'any.only': 'Payment method must be one of: COD, Card, UPI',
            'any.required': 'Payment method is required'
        })
    }),

    // Health metric validation
    logHealthMetric: Joi.object({
        metricType: Joi.string().valid('BP', 'HR', 'Weight', 'Glucose', 'Temperature').required().messages({
            'any.only': 'Metric type must be one of: BP, HR, Weight, Glucose, Temperature',
            'any.required': 'Metric type is required'
        }),
        value: Joi.alternatives().try(Joi.number(), Joi.string()).required().messages({
            'any.required': 'Value is required'
        }),
        unit: Joi.string().required().messages({
            'any.required': 'Unit is required'
        })
    }),

    // MR meeting validation
    requestMeeting: Joi.object({
        doctorId: Joi.string().required().messages({
            'any.required': 'Doctor ID is required'
        }),
        proposedDate: Joi.date().required().messages({
            'date.base': 'Proposed date must be a valid date',
            'any.required': 'Proposed date is required'
        }),
        proposedTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
            'string.pattern.base': 'Proposed time must be in HH:MM format',
            'any.required': 'Proposed time is required'
        }),
        purpose: Joi.string().max(200).required().messages({
            'string.max': 'Purpose cannot exceed 200 characters',
            'any.required': 'Purpose is required'
        })
    }),

    // Password reset validation
    forgotPassword: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email',
            'any.required': 'Email is required'
        })
    }),

    resetPassword: Joi.object({
        resetToken: Joi.string().required().messages({
            'any.required': 'Reset token is required'
        }),
        newPassword: Joi.string()
            .min(6)
            .pattern(/^(?=.*[A-Z])(?=.*\d)/)
            .required()
            .messages({
                'string.min': 'Password must be at least 6 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter and one number',
                'any.required': 'New password is required'
            }),
        confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Confirm password is required'
        })
    }),

    // Medical Record validation
    medicalRecord: Joi.object({
        recordName: Joi.string().required().messages({
            'any.required': 'Record name is required'
        }),
        recordType: Joi.string().valid('lab_report', 'test_result', 'prescription').required().messages({
            'any.only': 'Record type must be lab_report, test_result, or prescription',
            'any.required': 'Record type is required'
        }),
        recordUrl: Joi.string().allow('', null)
    }),

    // Emergency Contact validation
    emergencyContact: Joi.object({
        name: Joi.string().required().messages({
            'any.required': 'Name is required'
        }),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
            'string.pattern.base': 'Please provide a valid phone number',
            'any.required': 'Phone number is required'
        }),
        relation: Joi.string().required().messages({
            'any.required': 'Relation is required'
        }),
        isPrimary: Joi.boolean().default(false)
    }),

    // Chemist validation
    chemist: Joi.object({
        chemistName: Joi.string().required().messages({
            'any.required': 'Chemist name is required'
        }),
        contactPerson: Joi.string().required().messages({
            'any.required': 'Contact person name is required'
        }),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
            'string.pattern.base': 'Please provide a valid phone number',
            'any.required': 'Phone number is required'
        }),
        address: Joi.string().required().messages({
            'any.required': 'Address is required'
        }),
        city: Joi.string().required().messages({
            'any.required': 'City is required'
        })
    }),

    // Expense validation
    expense: Joi.object({
        amount: Joi.number().min(0).required().messages({
            'number.min': 'Amount cannot be negative',
            'any.required': 'Amount is required'
        }),
        expenseType: Joi.string().valid('travel', 'food', 'lodging', 'samples').required().messages({
            'any.only': 'Expense type must be travel, food, lodging, or samples',
            'any.required': 'Expense type is required'
        }),
        date: Joi.date().required().messages({
            'date.base': 'Expense date must be a valid date',
            'any.required': 'Expense date is required'
        }),
        description: Joi.string().allow('', null)
    }),

    // Tour Plan validation
    tourPlan: Joi.object({
        month: Joi.number().integer().min(1).max(12).required().messages({
            'number.min': 'Month must be between 1 and 12',
            'number.max': 'Month must be between 1 and 12',
            'any.required': 'Month is required'
        }),
        year: Joi.number().integer().required().messages({
            'any.required': 'Year is required'
        }),
        routes: Joi.array().items(
            Joi.object({
                date: Joi.date().required().messages({
                    'any.required': 'Route date is required'
                }),
                territory: Joi.string().required().messages({
                    'any.required': 'Territory city is required'
                }),
                objective: Joi.string().required().messages({
                    'any.required': 'Route objective is required'
                })
            })
        ).min(1).required().messages({
            'array.min': 'At least one route itinerary must be specified',
            'any.required': 'Routes list is required'
        })
    }),

    // DCR validation
    dcr: Joi.object({
        doctorId: Joi.string().required().messages({
            'any.required': 'Doctor ID is required'
        }),
        visitDate: Joi.date().required().messages({
            'date.base': 'Visit date must be a valid date',
            'any.required': 'Visit date is required'
        }),
        discussionPoints: Joi.string().required().messages({
            'any.required': 'Discussion points are required'
        }),
        samplesDistributed: Joi.array().items(
            Joi.object({
                sampleName: Joi.string().required().messages({
                    'any.required': 'Sample name is required'
                }),
                quantity: Joi.number().integer().min(1).required().messages({
                    'number.min': 'Quantity must be at least 1',
                    'any.required': 'Quantity is required'
                })
            })
        ).default([])
    }),

    // Profile updates Joi validations
    updatePatientProfile: Joi.object({
        firstName: Joi.string().max(50).optional(),
        lastName: Joi.string().max(50).optional(),
        phone: Joi.string().optional(),
        dob: Joi.any().optional(),
        gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say', 'Male', 'Female', 'Other').optional(),
        address: Joi.alternatives().try(
            Joi.string(),
            Joi.object({
                street: Joi.string().required(),
                city: Joi.string().required(),
                state: Joi.string().required(),
                zip: Joi.string().pattern(/^\d{5,6}(-\d{4})?$/).required()
            })
        ).optional(),
        bloodGroup: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown').optional(),
        emergencyContact: Joi.alternatives().try(
            Joi.object({
                name: Joi.string().required(),
                phone: Joi.string().required(),
                relation: Joi.string().required()
            }),
            Joi.string()
        ).optional(),
        medicalHistory: Joi.array().items(
            Joi.object({
                condition: Joi.string().required(),
                diagnosisDate: Joi.date().required(),
                status: Joi.string().valid('active', 'resolved', 'chronic').default('active'),
                notes: Joi.string().allow('', null)
            })
        ).optional(),
        allergies: Joi.array().items(
            Joi.object({
                allergen: Joi.string().required(),
                severity: Joi.string().valid('mild', 'moderate', 'severe').required(),
                reaction: Joi.string().allow('', null)
            })
        ).optional(),
        profilePhoto: Joi.string().allow('', null).optional()
    }).unknown(false),

    updateDoctorProfile: Joi.object({
        specialization: Joi.string().optional(),
        clinic: Joi.alternatives().try(
            Joi.string(),
            Joi.object({
                name: Joi.string().required(),
                address: Joi.string().required(),
                city: Joi.string().required(),
                phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
            })
        ).optional(),
        consultationFee: Joi.number().min(0).optional(),
        bio: Joi.string().allow('', null).optional(),
        profilePhoto: Joi.string().allow('', null).optional(),
        shift: shiftSchema.optional(),
        slotDurationMinutes: Joi.number().integer().min(1).optional()
    }).unknown(false),

    updateMRProfile: Joi.object({
        designation: Joi.string().optional(),
        territory: Joi.string().optional(),
        profilePhoto: Joi.string().allow('', null).optional()
    }).unknown(false)
};

// Validation middleware factory
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error } = schemas[schema].validate(req[property], { abortEarly: false });

        if (error) {
            const messages = error.details.map(detail => detail.message);
            return next(new ErrorResponse(messages.join(', '), 400));
        }

        next();
    };
};

module.exports = {
    validate,
    schemas
};