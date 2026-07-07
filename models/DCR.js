const mongoose = require('mongoose');

const sampleDistributedSchema = new mongoose.Schema({
    sampleName: {
        type: String,
        required: [true, 'Sample name is required'],
        trim: true
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [1, 'Quantity must be at least 1']
    }
}, { _id: false });

const dcrSchema = new mongoose.Schema({
    mrId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'MR ID is required']
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Doctor ID is required']
    },
    visitDate: {
        type: Date,
        required: [true, 'Visit date is required'],
        default: Date.now
    },
    discussionPoints: {
        type: String,
        required: [true, 'Discussion points are required'],
        trim: true
    },
    samplesDistributed: [sampleDistributedSchema]
}, {
    timestamps: true
});

dcrSchema.index({ mrId: 1 });
dcrSchema.index({ doctorId: 1 });
dcrSchema.index({ visitDate: -1 });

module.exports = mongoose.model('DCR', dcrSchema);
