const mongoose = require('mongoose');
const constants = require('../config/constants');

const mrMeetingSchema = new mongoose.Schema({
    mrId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MedicalRep',
        required: [true, 'MR ID is required'],

    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: [true, 'Doctor ID is required'],

    },
    requestId: {
        type: String,
        required: [true, 'Request ID is required'],
        unique: true,
        trim: true
    },
    requestedDate: {
        type: Date,
        required: [true, 'Requested date is required']
    },
    proposedDate: {
        type: Date,
        required: [true, 'Proposed date is required']
    },
    proposedTime: {
        type: String,
        required: [true, 'Proposed time is required']
    },
    purpose: {
        type: String,
        required: [true, 'Purpose is required'],
        trim: true,
        maxlength: [200, 'Purpose cannot exceed 200 characters']
    },
    products: [{
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
        focusArea: String
    }],
    message: {
        type: String,
        trim: true,
        maxlength: [500, 'Message cannot exceed 500 characters']
    },
    status: {
        type: String,
        enum: Object.values(constants.MEETING_STATUS),
        required: [true, 'Status is required'],
        default: constants.MEETING_STATUS.PENDING,
        index: true
    },
    meetingDate: {
        type: Date
    },
    meetingTime: {
        type: String
    },
    duration: {
        type: Number, // in minutes
        default: 30
    },
    meetingType: {
        type: String,
        enum: ['clinic', 'hospital', 'virtual', 'conference'],
        default: 'clinic'
    },
    meetingLink: {
        type: String,
        trim: true
    },
    location: {
        address: String,
        city: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    samplesProvided: [{
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
            min: [1, 'Quantity must be at least 1']
        },
        batchNo: String
    }],
    notes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },
    doctorNotes: {
        type: String,
        trim: true,
        maxlength: [500, 'Doctor notes cannot exceed 500 characters']
    },
    feedback: {
        rating: {
            type: Number,
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5']
        },
        comments: {
            type: String,
            trim: true,
            maxlength: [500, 'Comments cannot exceed 500 characters']
        },
        submittedBy: {
            type: String,
            enum: ['doctor', 'mr']
        },
        submittedAt: Date
    },
    nextFollowUp: {
        date: Date,
        purpose: String,
        notes: String
    },
    expenses: [{
        type: {
            type: String,
            enum: ['travel', 'meal', 'accommodation', 'misc'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: [0, 'Amount cannot be negative']
        },
        description: {
            type: String,
            trim: true
        },
        receiptUrl: String
    }],
    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        uploadedAt: Date
    }],
    reminders: [{
        type: {
            type: String,
            enum: ['email', 'sms', 'push']
        },
        sentAt: Date,
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed']
        }
    }],
    respondedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    cancellation: {
        requestedBy: {
            type: String,
            enum: ['mr', 'doctor', 'system']
        },
        reason: String,
        requestedAt: Date
    }
}, {
    timestamps: true
});

// Indexes
mrMeetingSchema.index({ mrId: 1, status: 1 });
mrMeetingSchema.index({ doctorId: 1, status: 1 });
mrMeetingSchema.index({ proposedDate: 1 });
mrMeetingSchema.index({ meetingDate: 1 });
// `requestId` is unique in the schema; skip duplicate index declaration.

// Virtual for formatted requested date
mrMeetingSchema.virtual('formattedRequestedDate').get(function () {
    if (!this.requestedDate) return null;
    return this.requestedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Virtual for formatted proposed date
mrMeetingSchema.virtual('formattedProposedDate').get(function () {
    if (!this.proposedDate) return null;
    return this.proposedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
});

// Virtual for formatted meeting date
mrMeetingSchema.virtual('formattedMeetingDate').get(function () {
    if (!this.meetingDate) return null;
    return this.meetingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Virtual for meeting status color
mrMeetingSchema.virtual('statusColor').get(function () {
    switch (this.status) {
        case constants.MEETING_STATUS.PENDING:
            return 'warning';
        case constants.MEETING_STATUS.APPROVED:
            return 'info';
        case constants.MEETING_STATUS.REJECTED:
            return 'danger';
        case constants.MEETING_STATUS.COMPLETED:
            return 'success';
        default:
            return 'secondary';
    }
});

// Virtual for time until meeting
mrMeetingSchema.virtual('timeUntilMeeting').get(function () {
    if (!this.meetingDate || this.status !== constants.MEETING_STATUS.APPROVED) {
        return null;
    }

    const meetingDateTime = new Date(this.meetingDate);
    if (this.meetingTime) {
        const [hours, minutes] = this.meetingTime.split(':');
        meetingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    const now = new Date();
    const diffMs = meetingDateTime - now;

    if (diffMs <= 0) return 'Past';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
});

// Static method to generate request ID
mrMeetingSchema.statics.generateRequestId = function () {
    const prefix = 'MRM';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${year}${month}${random}`;
};

// Method to approve meeting
mrMeetingSchema.methods.approve = function (meetingDate, meetingTime, notes = '') {
    this.status = constants.MEETING_STATUS.APPROVED;
    this.meetingDate = meetingDate || this.proposedDate;
    this.meetingTime = meetingTime || this.proposedTime;
    this.doctorNotes = notes;
    this.respondedAt = new Date();
};

// Method to reject meeting
mrMeetingSchema.methods.reject = function (reason = '') {
    this.status = constants.MEETING_STATUS.REJECTED;
    this.doctorNotes = reason || 'Meeting rejected';
    this.respondedAt = new Date();
};

// Method to complete meeting
mrMeetingSchema.methods.complete = function (notes = '', samples = [], feedback = null) {
    this.status = constants.MEETING_STATUS.COMPLETED;
    this.notes = notes;
    this.samplesProvided = samples;
    this.completedAt = new Date();

    if (feedback) {
        this.feedback = feedback;
    }
};

// Method to add product
mrMeetingSchema.methods.addProduct = function (productId, productName, category = '', focusArea = '') {
    this.products.push({
        productId,
        productName,
        category,
        focusArea
    });
};

// Method to add sample
mrMeetingSchema.methods.addSample = function (productId, productName, quantity, batchNo = '') {
    this.samplesProvided.push({
        productId,
        productName,
        quantity,
        batchNo
    });
};

// Method to add expense
mrMeetingSchema.methods.addExpense = function (type, amount, description = '', receiptUrl = '') {
    this.expenses.push({
        type,
        amount,
        description,
        receiptUrl
    });
};

// Method to calculate total expenses
mrMeetingSchema.methods.getTotalExpenses = function () {
    return this.expenses.reduce((total, expense) => total + expense.amount, 0);
};

// Method to add reminder
mrMeetingSchema.methods.addReminder = function (type, status = 'pending') {
    this.reminders.push({
        type,
        status,
        sentAt: status === 'sent' ? new Date() : null
    });
};

// Method to check if meeting can be cancelled
mrMeetingSchema.methods.canBeCancelled = function () {
    if (this.status === constants.MEETING_STATUS.CANCELLED) {
        return false;
    }

    if (this.status === constants.MEETING_STATUS.COMPLETED) {
        return false;
    }

    if (this.status === constants.MEETING_STATUS.REJECTED) {
        return false;
    }

    if (this.meetingDate) {
        const meetingDateTime = new Date(this.meetingDate);
        if (this.meetingTime) {
            const [hours, minutes] = this.meetingTime.split(':');
            meetingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }

        const now = new Date();
        const hoursUntil = (meetingDateTime - now) / (1000 * 60 * 60);

        // Can cancel up to 24 hours before meeting
        return hoursUntil > 24;
    }

    return true;
};

// Method to cancel meeting
mrMeetingSchema.methods.cancel = function (requestedBy, reason = '') {
    this.status = constants.MEETING_STATUS.CANCELLED;
    this.cancellation = {
        requestedBy,
        reason,
        requestedAt: new Date()
    };
};

// Pre-save middleware to generate request ID
mrMeetingSchema.pre('save', function (next) {
    if (!this.requestId) {
        this.requestId = this.constructor.generateRequestId();
    }

    next();
});

const MRMeetings = mongoose.model('MRMeetings', mrMeetingSchema);

module.exports = MRMeetings;