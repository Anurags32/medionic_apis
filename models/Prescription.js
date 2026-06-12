const mongoose = require('mongoose');
const constants = require('../config/constants');

const prescriptionSchema = new mongoose.Schema({
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: [true, 'Doctor ID is required']
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required']
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    medicines: [{
        medicineName: {
            type: String,
            required: [true, 'Medicine name is required'],
            trim: true
        },
        genericName: {
            type: String,
            trim: true
        },
        dosage: {
            type: String,
            required: [true, 'Dosage is required'],
            trim: true
        },
        frequency: {
            type: String,
            required: [true, 'Frequency is required'],
            trim: true
        },
        duration: {
            type: String,
            required: [true, 'Duration is required'],
            trim: true
        },
        quantity: {
            type: Number,
            required: [true, 'Quantity is required'],
            min: [1, 'Quantity must be at least 1']
        },
        instructions: {
            type: String,
            trim: true,
            maxlength: [500, 'Instructions cannot exceed 500 characters']
        },
        beforeMeal: {
            type: Boolean,
            default: false
        },
        withFood: {
            type: Boolean,
            default: false
        },
        avoidAlcohol: {
            type: Boolean,
            default: false
        },
        specialInstructions: String
    }],
    testRecommendations: [{
        testName: {
            type: String,
            required: [true, 'Test name is required'],
            trim: true
        },
        urgency: {
            type: String,
            enum: ['routine', 'urgent', 'emergency'],
            default: 'routine'
        },
        instructions: {
            type: String,
            trim: true
        },
        labName: String,
        fastingRequired: {
            type: Boolean,
            default: false
        },
        estimatedCost: Number
    }],
    followUpDate: {
        type: Date
    },
    followUpInstructions: {
        type: String,
        trim: true,
        maxlength: [500, 'Follow-up instructions cannot exceed 500 characters']
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },
    status: {
        type: String,
        enum: Object.values(constants.PRESCRIPTION_STATUS),
        default: constants.PRESCRIPTION_STATUS.ACTIVE
    },
    issuedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date
    },
    refillsAllowed: {
        type: Number,
        default: 0
    },
    refillsUsed: {
        type: Number,
        default: 0
    },
    pharmacyOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PharmacyOrder'
    },
    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        uploadedAt: Date
    }],
    signature: {
        doctorSignature: String,
        digitalSignature: String,
        signedAt: Date
    },
    validityPeriod: {
        type: Number, // in days
        default: 30
    }
}, {
    timestamps: true
});

// Indexes
prescriptionSchema.index({ patientId: 1, issuedAt: -1 });
prescriptionSchema.index({ doctorId: 1, issuedAt: -1 });
prescriptionSchema.index({ status: 1 });
prescriptionSchema.index({ appointmentId: 1 });
prescriptionSchema.index({ expiresAt: 1 });

// Virtual for prescription validity
prescriptionSchema.virtual('isValid').get(function () {
    if (this.status === constants.PRESCRIPTION_STATUS.EXPIRED) {
        return false;
    }

    if (this.status === constants.PRESCRIPTION_STATUS.COMPLETED) {
        return false;
    }

    if (this.expiresAt && new Date() > this.expiresAt) {
        return false;
    }

    if (this.refillsAllowed > 0 && this.refillsUsed >= this.refillsAllowed) {
        return false;
    }

    return true;
});

// Virtual for formatted issued date
prescriptionSchema.virtual('formattedIssuedDate').get(function () {
    if (!this.issuedAt) return null;
    return this.issuedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Virtual for formatted expiry date
prescriptionSchema.virtual('formattedExpiryDate').get(function () {
    if (!this.expiresAt) return null;
    return this.expiresAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Virtual for remaining refills
prescriptionSchema.virtual('remainingRefills').get(function () {
    return Math.max(0, this.refillsAllowed - this.refillsUsed);
});

// Virtual for days until expiry
prescriptionSchema.virtual('daysUntilExpiry').get(function () {
    if (!this.expiresAt) return null;

    const now = new Date();
    const expiryDate = new Date(this.expiresAt);
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
});

// Method to add medicine
prescriptionSchema.methods.addMedicine = function (medicineData) {
    this.medicines.push({
        medicineName: medicineData.medicineName,
        genericName: medicineData.genericName || '',
        dosage: medicineData.dosage,
        frequency: medicineData.frequency,
        duration: medicineData.duration,
        quantity: medicineData.quantity || 1,
        instructions: medicineData.instructions || '',
        beforeMeal: medicineData.beforeMeal || false,
        withFood: medicineData.withFood || false,
        avoidAlcohol: medicineData.avoidAlcohol || false,
        specialInstructions: medicineData.specialInstructions || ''
    });
};

// Method to add test recommendation
prescriptionSchema.methods.addTest = function (testData) {
    this.testRecommendations.push({
        testName: testData.testName,
        urgency: testData.urgency || 'routine',
        instructions: testData.instructions || '',
        labName: testData.labName || '',
        fastingRequired: testData.fastingRequired || false,
        estimatedCost: testData.estimatedCost || 0
    });
};

// Method to mark as completed
prescriptionSchema.methods.markAsCompleted = function () {
    this.status = constants.PRESCRIPTION_STATUS.COMPLETED;
};

// Method to mark as expired
prescriptionSchema.methods.markAsExpired = function () {
    this.status = constants.PRESCRIPTION_STATUS.EXPIRED;
};

// Method to use refill
prescriptionSchema.methods.useRefill = function () {
    if (this.refillsUsed < this.refillsAllowed) {
        this.refillsUsed += 1;
        return true;
    }
    return false;
};

// Method to check if prescription needs refill
prescriptionSchema.methods.needsRefill = function () {
    return this.refillsAllowed > 0 && this.refillsUsed < this.refillsAllowed;
};

// Method to calculate total medicine count
prescriptionSchema.methods.getTotalMedicines = function () {
    return this.medicines.reduce((total, medicine) => total + (medicine.quantity || 1), 0);
};

// Method to get medicine names
prescriptionSchema.methods.getMedicineNames = function () {
    return this.medicines.map(medicine => medicine.medicineName);
};

// Pre-save middleware to set expiry date
prescriptionSchema.pre('save', function (next) {
    if (!this.expiresAt && this.issuedAt) {
        const expiryDate = new Date(this.issuedAt);
        expiryDate.setDate(expiryDate.getDate() + (this.validityPeriod || 30));
        this.expiresAt = expiryDate;
    }

    // Auto-expire if expiry date has passed
    if (this.expiresAt && new Date() > this.expiresAt && this.status === constants.PRESCRIPTION_STATUS.ACTIVE) {
        this.status = constants.PRESCRIPTION_STATUS.EXPIRED;
    }

    next();
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;