const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Patient ID is required']
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
    },
    relation: {
        type: String,
        required: [true, 'Relation is required'],
        trim: true
    },
    isPrimary: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

emergencyContactSchema.index({ patientId: 1 });

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);
