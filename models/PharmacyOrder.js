const mongoose = require('mongoose');
const constants = require('../config/constants');

const pharmacyOrderSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required']
    },
    prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
    },
    orderNumber: {
        type: String,
        required: [true, 'Order number is required'],
        unique: true,
        trim: true
    },
    medicines: [{
        medicineName: {
            type: String,
            required: [true, 'Medicine name is required'],
            trim: true
        },
        genericName: String,
        quantity: {
            type: Number,
            required: [true, 'Quantity is required'],
            min: [1, 'Quantity must be at least 1']
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative']
        },
        dosage: String,
        manufacturer: String,
        batchNo: String,
        expiryDate: Date,
        isSubstitute: {
            type: Boolean,
            default: false
        },
        originalMedicine: String
    }],
    totalAmount: {
        type: Number,
        required: [true, 'Total amount is required'],
        min: [0, 'Total amount cannot be negative']
    },
    discountApplied: {
        type: Number,
        default: 0,
        min: [0, 'Discount cannot be negative']
    },
    taxAmount: {
        type: Number,
        default: 0,
        min: [0, 'Tax amount cannot be negative']
    },
    finalAmount: {
        type: Number,
        required: [true, 'Final amount is required'],
        min: [0, 'Final amount cannot be negative']
    },
    paymentMethod: {
        type: String,
        enum: Object.values(constants.PAYMENT_METHODS),
        required: [true, 'Payment method is required'],
        default: constants.PAYMENT_METHODS.COD
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    transactionId: String,
    deliveryAddress: {
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
            trim: true
        },
        landmark: String,
        contactPhone: {
            type: String,
            required: [true, 'Contact phone is required'],
            match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
        }
    },
    status: {
        type: String,
        enum: Object.values(constants.ORDER_STATUS),
        required: [true, 'Status is required'],
        default: constants.ORDER_STATUS.PENDING
    },
    trackingNumber: {
        type: String,
        trim: true
    },
    trackingUpdates: [{
        status: {
            type: String,
            required: true
        },
        location: String,
        description: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    estimatedDelivery: {
        type: Date
    },
    actualDelivery: {
        type: Date
    },
    deliveryPartner: {
        name: String,
        contact: String,
        trackingUrl: String
    },
    orderNotes: {
        type: String,
        trim: true,
        maxlength: [500, 'Order notes cannot exceed 500 characters']
    },
    cancellation: {
        requestedBy: {
            type: String,
            enum: ['patient', 'pharmacy', 'system']
        },
        reason: String,
        requestedAt: Date,
        approvedAt: Date,
        refundAmount: Number,
        refundStatus: {
            type: String,
            enum: ['pending', 'processed', 'failed']
        }
    },
    prescriptionRequired: {
        type: Boolean,
        default: true
    },
    prescriptionVerified: {
        type: Boolean,
        default: false
    },
    pharmacistNotes: String,
    patientInstructions: String,
    packaging: {
        type: String,
        enum: ['regular', 'childproof', 'senior_friendly'],
        default: 'regular'
    }
}, {
    timestamps: true
});

// Indexes
pharmacyOrderSchema.index({ patientId: 1, createdAt: -1 });
// `orderNumber` is unique in the schema; avoid duplicate index declaration.
pharmacyOrderSchema.index({ status: 1 });
pharmacyOrderSchema.index({ paymentStatus: 1 });
pharmacyOrderSchema.index({ trackingNumber: 1 });
pharmacyOrderSchema.index({ estimatedDelivery: 1 });
pharmacyOrderSchema.index({ prescriptionId: 1 });

// Virtual for formatted order date
pharmacyOrderSchema.virtual('formattedOrderDate').get(function () {
    if (!this.createdAt) return null;
    return this.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// Virtual for formatted delivery date
pharmacyOrderSchema.virtual('formattedDeliveryDate').get(function () {
    if (!this.estimatedDelivery) return null;
    return this.estimatedDelivery.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
});

// Virtual for order status color
pharmacyOrderSchema.virtual('statusColor').get(function () {
    switch (this.status) {
        case constants.ORDER_STATUS.PENDING:
            return 'warning';
        case constants.ORDER_STATUS.CONFIRMED:
            return 'info';
        case constants.ORDER_STATUS.SHIPPED:
            return 'primary';
        case constants.ORDER_STATUS.DELIVERED:
            return 'success';
        default:
            return 'secondary';
    }
});

// Virtual for delivery progress percentage
pharmacyOrderSchema.virtual('deliveryProgress').get(function () {
    switch (this.status) {
        case constants.ORDER_STATUS.PENDING:
            return 0;
        case constants.ORDER_STATUS.CONFIRMED:
            return 25;
        case constants.ORDER_STATUS.SHIPPED:
            return 75;
        case constants.ORDER_STATUS.DELIVERED:
            return 100;
        default:
            return 0;
    }
});

// Virtual for time until delivery
pharmacyOrderSchema.virtual('timeUntilDelivery').get(function () {
    if (!this.estimatedDelivery || this.status === constants.ORDER_STATUS.DELIVERED) {
        return null;
    }

    const now = new Date();
    const deliveryDate = new Date(this.estimatedDelivery);
    const diffMs = deliveryDate - now;

    if (diffMs <= 0) return 'Overdue';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
});

// Virtual for medicine count
pharmacyOrderSchema.virtual('medicineCount').get(function () {
    return this.medicines.reduce((total, medicine) => total + medicine.quantity, 0);
});

// Method to generate order number
pharmacyOrderSchema.statics.generateOrderNumber = function () {
    const prefix = 'ORD';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${year}${month}${random}`;
};

// Method to add medicine to order
pharmacyOrderSchema.methods.addMedicine = function (medicineData) {
    this.medicines.push({
        medicineName: medicineData.medicineName,
        genericName: medicineData.genericName || '',
        quantity: medicineData.quantity,
        price: medicineData.price,
        dosage: medicineData.dosage || '',
        manufacturer: medicineData.manufacturer || '',
        batchNo: medicineData.batchNo || '',
        expiryDate: medicineData.expiryDate || null,
        isSubstitute: medicineData.isSubstitute || false,
        originalMedicine: medicineData.originalMedicine || ''
    });
};

// Method to calculate amounts
pharmacyOrderSchema.methods.calculateAmounts = function () {
    const subtotal = this.medicines.reduce((total, medicine) => {
        return total + (medicine.price * medicine.quantity);
    }, 0);

    this.totalAmount = subtotal;
    this.finalAmount = subtotal - this.discountApplied + this.taxAmount;
};

// Method to update status
pharmacyOrderSchema.methods.updateStatus = function (newStatus, location = '', description = '') {
    const oldStatus = this.status;
    this.status = newStatus;

    this.trackingUpdates.push({
        status: newStatus,
        location,
        description,
        timestamp: new Date()
    });

    return oldStatus;
};

// Method to add tracking update
pharmacyOrderSchema.methods.addTrackingUpdate = function (status, location = '', description = '') {
    this.trackingUpdates.push({
        status,
        location,
        description,
        timestamp: new Date()
    });

    if (status === constants.ORDER_STATUS.DELIVERED) {
        this.actualDelivery = new Date();
    }
};

// Method to cancel order
pharmacyOrderSchema.methods.cancelOrder = function (requestedBy, reason = '') {
    this.status = constants.ORDER_STATUS.CANCELLED;
    this.cancellation = {
        requestedBy,
        reason,
        requestedAt: new Date(),
        refundAmount: this.paymentStatus === 'completed' ? this.finalAmount : 0,
        refundStatus: this.paymentStatus === 'completed' ? 'pending' : 'not_applicable'
    };
};

// Method to check if order can be cancelled
pharmacyOrderSchema.methods.canBeCancelled = function () {
    if (this.status === constants.ORDER_STATUS.CANCELLED) {
        return false;
    }

    if (this.status === constants.ORDER_STATUS.DELIVERED) {
        return false;
    }

    if (this.status === constants.ORDER_STATUS.SHIPPED) {
        return false;
    }

    return true;
};

// Pre-save middleware to generate order number and calculate amounts
pharmacyOrderSchema.pre('save', function (next) {
    if (!this.orderNumber) {
        this.orderNumber = this.constructor.generateOrderNumber();
    }

    if (this.isModified('medicines') || this.isModified('discountApplied') || this.isModified('taxAmount')) {
        this.calculateAmounts();
    }

    // Auto-set estimated delivery (2 days from order)
    if (!this.estimatedDelivery) {
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 2);
        this.estimatedDelivery = deliveryDate;
    }

    next();
});

const PharmacyOrder = mongoose.model('PharmacyOrder', pharmacyOrderSchema);

module.exports = PharmacyOrder;