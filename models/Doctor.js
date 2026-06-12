const mongoose = require('mongoose');
const constants = require('../config/constants');

const doctorSchema = new mongoose.Schema({
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
    specialization: {
        type: String,
        required: [true, 'Specialization is required'],
        trim: true,

    },
    licenseNumber: {
        type: String,
        required: [true, 'License number is required'],
        unique: true,
        trim: true
    },
    yearsExperience: {
        type: Number,
        required: [true, 'Years of experience is required'],
        min: [0, 'Years of experience cannot be negative']
    },
    clinic: {
        name: {
            type: String,
            required: [true, 'Clinic name is required'],
            trim: true
        },
        address: {
            type: String,
            required: [true, 'Clinic address is required'],
            trim: true
        },
        city: {
            type: String,
            required: [true, 'Clinic city is required'],
            trim: true,

        },
        phone: {
            type: String,
            required: [true, 'Clinic phone is required'],
            match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
        },
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    consultationFee: {
        type: Number,
        required: [true, 'Consultation fee is required'],
        min: [0, 'Consultation fee cannot be negative']
    },
    consultationTypes: [{
        type: String,
        enum: Object.values(constants.CONSULTATION_TYPES),
        default: [constants.CONSULTATION_TYPES.CLINIC]
    }],
    rating: {
        type: Number,
        default: 0,
        min: [0, 'Rating cannot be negative'],
        max: [5, 'Rating cannot exceed 5']
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    bio: {
        type: String,
        trim: true,
        maxlength: [1000, 'Bio cannot exceed 1000 characters']
    },
    certificates: [{
        name: String,
        issuingAuthority: String,
        issueDate: Date,
        expiryDate: Date,
        certificateUrl: String
    }],
    verificationStatus: {
        type: String,
        enum: Object.values(constants.VERIFICATION_STATUS),
        default: constants.VERIFICATION_STATUS.PENDING
    },
    verificationDocuments: [{
        documentType: String,
        documentUrl: String,
        uploadedAt: Date
    }],
    availability: {
        monday: [{ startTime: String, endTime: String, maxPatients: Number }],
        tuesday: [{ startTime: String, endTime: String, maxPatients: Number }],
        wednesday: [{ startTime: String, endTime: String, maxPatients: Number }],
        thursday: [{ startTime: String, endTime: String, maxPatients: Number }],
        friday: [{ startTime: String, endTime: String, maxPatients: Number }],
        saturday: [{ startTime: String, endTime: String, maxPatients: Number }],
        sunday: [{ startTime: String, endTime: String, maxPatients: Number }]
    },
    holidays: [{
        date: Date,
        reason: String
    }],
    profilePicture: String,
    languages: [{
        type: String,
        default: ['English']
    }],
    education: [{
        degree: String,
        institution: String,
        year: Number
    }],
    totalEarnings: {
        type: Number,
        default: 0
    },
    pendingWithdrawal: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes
// `userId` is marked `unique: true` in the schema; avoid duplicate index declaration.
// Inline `index` flags for `specialization` and `clinic.city` were removed to prevent duplicates.
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ 'clinic.city': 1 });
doctorSchema.index({ rating: -1 });
doctorSchema.index({ consultationFee: 1 });
doctorSchema.index({ verificationStatus: 1 });
doctorSchema.index({ totalEarnings: -1 });

// Virtual for full name
doctorSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for display name with specialization
doctorSchema.virtual('displayName').get(function () {
    return `Dr. ${this.firstName} ${this.lastName} - ${this.specialization}`;
});

// Virtual for total experience
doctorSchema.virtual('experience').get(function () {
    if (this.yearsExperience < 1) {
        return 'Less than a year';
    } else if (this.yearsExperience === 1) {
        return '1 year';
    } else {
        return `${this.yearsExperience} years`;
    }
});

// Method to update rating
doctorSchema.methods.updateRating = function (newRating) {
    const totalScore = (this.rating * this.totalRatings) + newRating;
    this.totalRatings += 1;
    this.rating = totalScore / this.totalRatings;
    return this.rating;
};

// Method to check if doctor is available on a specific date and time
doctorSchema.methods.isAvailable = function (date, time) {
    const dayOfWeek = date.getDay();
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = dayMap[dayOfWeek];

    // Check if it's a holiday
    const isHoliday = this.holidays.some(holiday => {
        const holidayDate = new Date(holiday.date);
        return holidayDate.toDateString() === date.toDateString();
    });

    if (isHoliday) return false;

    // Check availability for the day
    const dayAvailability = this.availability[day];
    if (!dayAvailability || dayAvailability.length === 0) return false;

    // Check if time falls within any slot
    return dayAvailability.some(slot => {
        const [startHour, startMinute] = slot.startTime.split(':').map(Number);
        const [endHour, endMinute] = slot.endTime.split(':').map(Number);

        const slotStart = new Date(date);
        slotStart.setHours(startHour, startMinute, 0, 0);

        const slotEnd = new Date(date);
        slotEnd.setHours(endHour, endMinute, 0, 0);

        const checkTime = new Date(date);
        const [checkHour, checkMinute] = time.split(':').map(Number);
        checkTime.setHours(checkHour, checkMinute, 0, 0);

        return checkTime >= slotStart && checkTime <= slotEnd;
    });
};

// Method to add availability slot
doctorSchema.methods.addAvailability = function (day, startTime, endTime, maxPatients = 10) {
    if (!this.availability[day]) {
        this.availability[day] = [];
    }

    this.availability[day].push({
        startTime,
        endTime,
        maxPatients
    });
};

// Method to add holiday
doctorSchema.methods.addHoliday = function (date, reason = 'Personal') {
    this.holidays.push({
        date,
        reason
    });
};

// Method to add certificate
doctorSchema.methods.addCertificate = function (name, issuingAuthority, issueDate, expiryDate = null, certificateUrl = '') {
    this.certificates.push({
        name,
        issuingAuthority,
        issueDate,
        expiryDate,
        certificateUrl
    });
};

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;