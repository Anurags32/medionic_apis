const mongoose = require('mongoose');
const constants = require('../config/constants');

const appointmentSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required'],
        index: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: [true, 'Doctor ID is required'],
        index: true
    },
    appointmentDate: {
        type: Date,
        required: [true, 'Appointment date is required'],
        index: true
    },
    appointmentTime: {
        type: String,
        required: [true, 'Appointment time is required']
    },
    consultationType: {
        type: String,
        enum: Object.values(constants.CONSULTATION_TYPES),
        required: [true, 'Consultation type is required'],
        default: constants.CONSULTATION_TYPES.CLINIC
    },
    status: {
        type: String,
        enum: Object.values(constants.APPOINTMENT_STATUS),
        required: [true, 'Status is required'],
        default: constants.APPOINTMENT_STATUS.PENDING
    },
    symptoms: {
        type: String,
        required: [true, 'Symptoms description is required'],
        trim: true,
        maxlength: [500, 'Symptoms cannot exceed 500 characters']
    },
    duration: {
        type: Number, // in minutes
        default: 15
    },
    consultationLink: {
        type: String,
        trim: true
    },
    meetingId: {
        type: String,
        trim: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'refunded'],
        default: 'pending'
    },
    amount: {
        type: Number,
        default: 0
    },
    paymentMethod: {
        type: String,
        enum: ['COD', 'Card', 'UPI', 'Wallet'],
        default: 'COD'
    },
    transactionId: String,
    doctorNotes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Doctor notes cannot exceed 1000 characters']
    },
    diagnosis: {
        type: String,
        trim: true,
        maxlength: [500, 'Diagnosis cannot exceed 500 characters']
    },
    followUpRequired: {
        type: Boolean,
        default: false
    },
    followUpDate: Date,
    prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Prescription'
    },
    rating: {
        value: {
            type: Number,
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5']
        },
        feedback: {
            type: String,
            trim: true,
            maxlength: [500, 'Feedback cannot exceed 500 characters']
        },
        submittedAt: Date
    },
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
    cancellation: {
        requestedBy: {
            type: String,
            enum: ['patient', 'doctor', 'system']
        },
        reason: String,
        requestedAt: Date,
        approvedAt: Date
    }
}, {
    timestamps: true
});

// Indexes
appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });
appointmentSchema.index({ 'appointmentDate': 1, 'doctorId': 1 }, { unique: false });

// Virtual for formatted date
appointmentSchema.virtual('formattedDate').get(function () {
    if (!this.appointmentDate) return null;
    return this.appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

// Virtual for formatted time
appointmentSchema.virtual('formattedTime').get(function () {
    if (!this.appointmentTime) return null;

    const [hours, minutes] = this.appointmentTime.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;

    return `${hour12}:${minutes} ${ampm}`;
});

// Virtual for appointment status color
appointmentSchema.virtual('statusColor').get(function () {
    switch (this.status) {
        case constants.APPOINTMENT_STATUS.PENDING:
            return 'warning';
        case constants.APPOINTMENT_STATUS.CONFIRMED:
            return 'info';
        case constants.APPOINTMENT_STATUS.COMPLETED:
            return 'success';
        case constants.APPOINTMENT_STATUS.CANCELLED:
            return 'danger';
        default:
            return 'secondary';
    }
});

// Virtual for time until appointment
appointmentSchema.virtual('timeUntil').get(function () {
    if (!this.appointmentDate || !this.appointmentTime) return null;

    const appointmentDateTime = new Date(this.appointmentDate);
    const [hours, minutes] = this.appointmentTime.split(':');
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();
    const diffMs = appointmentDateTime - now;

    if (diffMs <= 0) return 'Past';

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    }
});

// Method to check if appointment can be cancelled
appointmentSchema.methods.canBeCancelled = function () {
    if (this.status === constants.APPOINTMENT_STATUS.CANCELLED) {
        return false;
    }

    if (this.status === constants.APPOINTMENT_STATUS.COMPLETED) {
        return false;
    }

    const appointmentDateTime = new Date(this.appointmentDate);
    const [hours, minutes] = this.appointmentTime.split(':');
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();
    const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60);

    // Can cancel up to 2 hours before appointment
    return hoursUntil > 2;
};

// Method to check if appointment can be rescheduled
appointmentSchema.methods.canBeRescheduled = function () {
    if (this.status === constants.APPOINTMENT_STATUS.CANCELLED) {
        return false;
    }

    if (this.status === constants.APPOINTMENT_STATUS.COMPLETED) {
        return false;
    }

    const appointmentDateTime = new Date(this.appointmentDate);
    const [hours, minutes] = this.appointmentTime.split(':');
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();
    const hoursUntil = (appointmentDateTime - now) / (1000 * 60 * 60);

    // Can reschedule up to 4 hours before appointment
    return hoursUntil > 4;
};

// Method to mark as completed
appointmentSchema.methods.markAsCompleted = function (notes = '', diagnosis = '') {
    this.status = constants.APPOINTMENT_STATUS.COMPLETED;
    this.doctorNotes = notes;
    this.diagnosis = diagnosis;
    this.completedAt = new Date();
};

// Method to cancel appointment
appointmentSchema.methods.cancel = function (requestedBy, reason = '') {
    this.status = constants.APPOINTMENT_STATUS.CANCELLED;
    this.cancellation = {
        requestedBy,
        reason,
        requestedAt: new Date()
    };
};

// Method to add reminder
appointmentSchema.methods.addReminder = function (type, status = 'pending') {
    this.reminders.push({
        type,
        status,
        sentAt: status === 'sent' ? new Date() : null
    });
};

// Pre-save middleware to validate appointment date
appointmentSchema.pre('save', function (next) {
    if (this.appointmentDate) {
        const appointmentDate = new Date(this.appointmentDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Appointment date cannot be in the past
        if (appointmentDate < today) {
            return next(new Error('Appointment date cannot be in the past'));
        }
    }

    next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;