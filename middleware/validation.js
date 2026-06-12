const Joi = require('joi');
const ErrorResponse = require('../utils/errorResponse');

// Validation schemas
const schemas = {
    // Auth validation
    register: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email',
            'any.required': 'Email is required'
        }),
        password: Joi.string()
            .min(8)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
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
        firstName: Joi.string().max(50).required().messages({
            'string.max': 'First name cannot exceed 50 characters',
            'any.required': 'First name is required'
        }),
        lastName: Joi.string().max(50).required().messages({
            'string.max': 'Last name cannot exceed 50 characters',
            'any.required': 'Last name is required'
        }),
        dob: Joi.date().required().messages({
            'date.base': 'Date of birth must be a valid date',
            'any.required': 'Date of birth is required'
        }),
        gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').required().messages({
            'any.only': 'Gender must be one of: male, female, other, prefer-not-to-say',
            'any.required': 'Gender is required'
        }),
        address: Joi.object({
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
            })
        }).required(),
        bloodGroup: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'),
        emergencyContact: Joi.object({
            name: Joi.string().required().messages({
                'any.required': 'Emergency contact name is required'
            }),
            phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
                'string.pattern.base': 'Please provide a valid phone number',
                'any.required': 'Emergency contact phone is required'
            }),
            relation: Joi.string().required().messages({
                'any.required': 'Emergency contact relation is required'
            })
        }).required()
    }),

    doctorProfile: Joi.object({
        firstName: Joi.string().max(50).required().messages({
            'string.max': 'First name cannot exceed 50 characters',
            'any.required': 'First name is required'
        }),
        lastName: Joi.string().max(50).required().messages({
            'string.max': 'Last name cannot exceed 50 characters',
            'any.required': 'Last name is required'
        }),
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
        clinic: Joi.object({
            name: Joi.string().required().messages({
                'any.required': 'Clinic name is required'
            }),
            address: Joi.string().required().messages({
                'any.required': 'Clinic address is required'
            }),
            city: Joi.string().required().messages({
                'any.required': 'Clinic city is required'
            }),
            phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
                'string.pattern.base': 'Please provide a valid phone number',
                'any.required': 'Clinic phone is required'
            })
        }).required(),
        consultationFee: Joi.number().min(0).required().messages({
            'number.min': 'Consultation fee cannot be negative',
            'any.required': 'Consultation fee is required'
        })
    }),

    mrProfile: Joi.object({
        firstName: Joi.string().max(50).required().messages({
            'string.max': 'First name cannot exceed 50 characters',
            'any.required': 'First name is required'
        }),
        lastName: Joi.string().max(50).required().messages({
            'string.max': 'Last name cannot exceed 50 characters',
            'any.required': 'Last name is required'
        }),
        companyName: Joi.string().required().messages({
            'any.required': 'Company name is required'
        }),
        territory: Joi.string().required().messages({
            'any.required': 'Territory is required'
        }),
        designation: Joi.string().required().messages({
            'any.required': 'Designation is required'
        })
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
        })
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
        value: Joi.number().required().messages({
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
            .min(8)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .required()
            .messages({
                'string.min': 'Password must be at least 8 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character',
                'any.required': 'New password is required'
            }),
        confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
            'any.only': 'Passwords do not match',
            'any.required': 'Confirm password is required'
        })
    })
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