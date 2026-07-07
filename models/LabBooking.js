const mongoose = require('mongoose');

const labBookingSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required']
    },
    testIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LabTest',
        required: [true, 'At least one test is required']
    }],
    scheduledAt: {
        type: Date,
        required: [true, 'Scheduled date and time are required']
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending'
    }
}, {
    timestamps: true
});

const LabBooking = mongoose.model('LabBooking', labBookingSchema);

module.exports = LabBooking;
