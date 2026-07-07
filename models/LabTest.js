const mongoose = require('mongoose');

const labTestSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Test name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    sampleType: {
        type: String,
        required: [true, 'Sample type is required'],
        trim: true
    }
}, {
    timestamps: true
});

const LabTest = mongoose.model('LabTest', labTestSchema);

module.exports = LabTest;
