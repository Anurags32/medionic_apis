const mongoose = require('mongoose');

const chemistSchema = new mongoose.Schema({
    mrId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'MR ID is required']
    },
    chemistName: {
        type: String,
        required: [true, 'Chemist name is required'],
        trim: true
    },
    contactPerson: {
        type: String,
        required: [true, 'Contact person is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
    },
    address: {
        type: String,
        required: [true, 'Address is required'],
        trim: true
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true
    }
}, {
    timestamps: true
});

chemistSchema.index({ mrId: 1 });
chemistSchema.index({ city: 1 });

module.exports = mongoose.model('Chemist', chemistSchema);
