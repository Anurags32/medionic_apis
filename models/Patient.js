const mongoose = require('mongoose');
const constants = require('../config/constants');

const patientSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        unique: true
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    dob: {
        type: Date,
        required: [true, 'Date of birth is required']
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other', 'prefer-not-to-say'],
        required: [true, 'Gender is required']
    },
    address: {
        street: {
            type: String,
            required: [true, 'Street address is required'],
            trim: true
        },
        city: {
            type: String,
            required: [true, 'City is required'],
            trim: true
        },
        state: {
            type: String,
            required: [true, 'State is required'],
            trim: true
        },
        zip: {
            type: String,
            required: [true, 'ZIP code is required'],
            trim: true,
            match: [/^\d{5,6}(-\d{4})?$/, 'Please provide a valid ZIP code']
        }
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'],
        default: 'unknown'
    },
    emergencyContact: {
        name: {
            type: String,
            required: [true, 'Emergency contact name is required'],
            trim: true
        },
        phone: {
            type: String,
            required: [true, 'Emergency contact phone is required'],
            match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
        },
        relation: {
            type: String,
            required: [true, 'Emergency contact relation is required'],
            trim: true
        }
    },
    medicalHistory: [{
        condition: {
            type: String,
            required: true,
            trim: true
        },
        diagnosisDate: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ['active', 'resolved', 'chronic'],
            default: 'active'
        },
        notes: String
    }],
    allergies: [{
        allergen: {
            type: String,
            required: true,
            trim: true
        },
        severity: {
            type: String,
            enum: ['mild', 'moderate', 'severe'],
            required: true
        },
        reaction: String
    }],
    insuranceDetails: {
        provider: {
            type: String,
            trim: true
        },
        policyNumber: {
            type: String,
            trim: true
        },
        expiryDate: Date
    },
    primaryDoctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor'
    },
    height: {
        value: Number,
        unit: {
            type: String,
            enum: ['cm', 'inches'],
            default: 'cm'
        }
    },
    weight: {
        value: Number,
        unit: {
            type: String,
            enum: ['kg', 'lbs'],
            default: 'kg'
        },
        lastUpdated: Date
    },
    profilePicture: String,
    preferences: {
        language: {
            type: String,
            default: 'en'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            sms: {
                type: Boolean,
                default: false
            },
            push: {
                type: Boolean,
                default: true
            }
        }
    }
}, {
    timestamps: true
});

// Indexes
// `userId` is marked `unique: true` in the schema; avoid duplicate index declaration.
patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ 'address.city': 1 });
patientSchema.index({ dob: 1 });
patientSchema.index({ 'emergencyContact.phone': 1 });

// Virtual for age
patientSchema.virtual('age').get(function () {
    if (!this.dob) return null;

    const today = new Date();
    const birthDate = new Date(this.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
});

// Virtual for full name
patientSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for formatted address
patientSchema.virtual('formattedAddress').get(function () {
    return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zip}`;
});

// Method to add medical history
patientSchema.methods.addMedicalHistory = function (condition, diagnosisDate, status = 'active', notes = '') {
    this.medicalHistory.push({
        condition,
        diagnosisDate,
        status,
        notes
    });
};

// Method to add allergy
patientSchema.methods.addAllergy = function (allergen, severity, reaction = '') {
    this.allergies.push({
        allergen,
        severity,
        reaction
    });
};

// Pre-save middleware
patientSchema.pre('save', function (next) {
    // Convert dob to date if it's a string
    if (this.dob && typeof this.dob === 'string') {
        this.dob = new Date(this.dob);
    }

    // Update weight lastUpdated if weight changes
    if (this.isModified('weight.value')) {
        this.weight.lastUpdated = new Date();
    }

    next();
});

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;