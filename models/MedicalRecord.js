const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Patient ID is required']
    },
    recordName: {
        type: String,
        required: [true, 'Record name is required'],
        trim: true
    },
    recordType: {
        type: String,
        enum: ['lab_report', 'test_result', 'prescription'],
        required: [true, 'Record type is required']
    },
    recordUrl: {
        type: String,
        required: [true, 'Record URL is required']
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

medicalRecordSchema.index({ patientId: 1 });
medicalRecordSchema.index({ recordType: 1 });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
