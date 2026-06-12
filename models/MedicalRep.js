const mongoose = require('mongoose');

const medicalRepSchema = new mongoose.Schema({
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
    companyName: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true
    },
    territory: {
        type: String,
        required: [true, 'Territory is required'],
        trim: true,

    },
    designation: {
        type: String,
        required: [true, 'Designation is required'],
        trim: true
    },
    reportingManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MedicalRep'
    },
    productsHandled: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        productName: {
            type: String,
            required: true,
            trim: true
        },
        category: String,
        targetUnits: Number,
        achievedUnits: {
            type: Number,
            default: 0
        }
    }],
    sampleInventory: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        productName: {
            type: String,
            required: true,
            trim: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [0, 'Quantity cannot be negative']
        },
        batchNo: String,
        expiryDate: Date
    }],
    monthlyTarget: {
        type: Number,
        default: 0,
        min: [0, 'Monthly target cannot be negative']
    },
    achievedTarget: {
        type: Number,
        default: 0,
        min: [0, 'Achieved target cannot be negative']
    },
    employmentDetails: {
        joiningDate: {
            type: Date,
            required: [true, 'Joining date is required']
        },
        employeeId: {
            type: String,
            required: [true, 'Employee ID is required'],
            unique: true,
            trim: true
        },
        department: String
    },
    contactDetails: {
        workPhone: {
            type: String,
            match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
        },
        workEmail: {
            type: String,
            lowercase: true,
            trim: true,
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
        },
        alternatePhone: {
            type: String,
            match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
        }
    },
    performanceMetrics: {
        totalVisits: {
            type: Number,
            default: 0
        },
        successfulVisits: {
            type: Number,
            default: 0
        },
        totalDoctors: {
            type: Number,
            default: 0
        },
        activeDoctors: {
            type: Number,
            default: 0
        },
        totalSales: {
            type: Number,
            default: 0
        },
        incentiveEarned: {
            type: Number,
            default: 0
        }
    },
    profilePicture: String,
    preferences: {
        notificationFrequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            default: 'daily'
        },
        reportFormat: {
            type: String,
            enum: ['pdf', 'excel', 'both'],
            default: 'pdf'
        }
    }
}, {
    timestamps: true
});

// Indexes
// `userId` and `employmentDetails.employeeId` are marked `unique` in the schema; avoid duplicate index declarations.
medicalRepSchema.index({ territory: 1 });
medicalRepSchema.index({ companyName: 1 });
medicalRepSchema.index({ designation: 1 });
medicalRepSchema.index({ achievedTarget: -1 });

// Virtual for full name
medicalRepSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for display name
medicalRepSchema.virtual('displayName').get(function () {
    return `${this.firstName} ${this.lastName} - ${this.designation} (${this.companyName})`;
});

// Virtual for tenure
medicalRepSchema.virtual('tenure').get(function () {
    if (!this.employmentDetails.joiningDate) return null;

    const joiningDate = new Date(this.employmentDetails.joiningDate);
    const today = new Date();

    const years = today.getFullYear() - joiningDate.getFullYear();
    const months = today.getMonth() - joiningDate.getMonth();

    let tenureMonths = years * 12 + months;
    if (today.getDate() < joiningDate.getDate()) {
        tenureMonths--;
    }

    if (tenureMonths < 12) {
        return `${tenureMonths} month${tenureMonths !== 1 ? 's' : ''}`;
    } else {
        const years = Math.floor(tenureMonths / 12);
        const remainingMonths = tenureMonths % 12;
        if (remainingMonths === 0) {
            return `${years} year${years !== 1 ? 's' : ''}`;
        } else {
            return `${years} year${years !== 1 ? 's' : ''} ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
        }
    }
});

// Virtual for target achievement percentage
medicalRepSchema.virtual('achievementPercentage').get(function () {
    if (this.monthlyTarget === 0) return 0;
    return Math.round((this.achievedTarget / this.monthlyTarget) * 100);
});

// Method to add product
medicalRepSchema.methods.addProduct = function (productId, productName, category = '', targetUnits = 0) {
    this.productsHandled.push({
        productId,
        productName,
        category,
        targetUnits,
        achievedUnits: 0
    });
};

// Method to update product achievement
medicalRepSchema.methods.updateProductAchievement = function (productId, achievedUnits) {
    const product = this.productsHandled.id(productId);
    if (product) {
        product.achievedUnits = achievedUnits;
        return true;
    }
    return false;
};

// Method to add sample to inventory
medicalRepSchema.methods.addSample = function (productId, productName, quantity, batchNo = '', expiryDate = null) {
    this.sampleInventory.push({
        productId,
        productName,
        quantity,
        batchNo,
        expiryDate
    });
};

// Method to distribute sample
medicalRepSchema.methods.distributeSample = function (productId, quantity) {
    const sample = this.sampleInventory.find(s => s.productId.toString() === productId.toString());
    if (sample && sample.quantity >= quantity) {
        sample.quantity -= quantity;
        return true;
    }
    return false;
};

// Method to check sample stock
medicalRepSchema.methods.checkSampleStock = function (productId) {
    const sample = this.sampleInventory.find(s => s.productId.toString() === productId.toString());
    return sample ? sample.quantity : 0;
};

// Method to update performance metrics
medicalRepSchema.methods.updatePerformance = function (visitSuccessful = false, salesAmount = 0, doctorAdded = false) {
    this.performanceMetrics.totalVisits += 1;

    if (visitSuccessful) {
        this.performanceMetrics.successfulVisits += 1;
    }

    if (doctorAdded) {
        this.performanceMetrics.totalDoctors += 1;
        this.performanceMetrics.activeDoctors += 1;
    }

    if (salesAmount > 0) {
        this.performanceMetrics.totalSales += salesAmount;
        this.achievedTarget += salesAmount;
    }
};

// Method to calculate incentive (simplified)
medicalRepSchema.methods.calculateIncentive = function () {
    const achievement = this.achievementPercentage;
    let incentiveRate = 0;

    if (achievement >= 100) incentiveRate = 0.15; // 15% for 100%+ achievement
    else if (achievement >= 80) incentiveRate = 0.10; // 10% for 80-99%
    else if (achievement >= 60) incentiveRate = 0.07; // 7% for 60-79%
    else if (achievement >= 40) incentiveRate = 0.05; // 5% for 40-59%

    const incentive = this.achievedTarget * incentiveRate;
    this.performanceMetrics.incentiveEarned = incentive;
    return incentive;
};

const MedicalRep = mongoose.model('MedicalRep', medicalRepSchema);

module.exports = MedicalRep;