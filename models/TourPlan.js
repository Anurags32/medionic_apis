const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: [true, 'Route date is required']
    },
    territory: {
        type: String,
        required: [true, 'Territory is required'],
        trim: true
    },
    objective: {
        type: String,
        required: [true, 'Objective is required'],
        trim: true
    }
}, { _id: false });

const tourPlanSchema = new mongoose.Schema({
    mrId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'MR ID is required']
    },
    month: {
        type: Number,
        required: [true, 'Month is required'],
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: [true, 'Year is required']
    },
    routes: [routeSchema]
}, {
    timestamps: true
});

tourPlanSchema.index({ mrId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('TourPlan', tourPlanSchema);
