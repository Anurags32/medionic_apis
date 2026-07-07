const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required']
    },
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    relation: {
        type: String,
        required: [true, 'Relation is required'],
        trim: true
    },
    dob: {
        type: Date,
        required: [true, 'Date of birth is required']
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        required: [true, 'Gender is required'],
        lowercase: true
    }
}, {
    timestamps: true
});

const FamilyMember = mongoose.model('FamilyMember', familyMemberSchema);

module.exports = FamilyMember;
