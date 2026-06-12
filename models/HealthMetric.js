const mongoose = require('mongoose');
const constants = require('../config/constants');

const healthMetricSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: [true, 'Patient ID is required'],
        index: true
    },
    metricType: {
        type: String,
        enum: Object.values(constants.HEALTH_METRICS),
        required: [true, 'Metric type is required'],
        index: true
    },
    value: {
        type: Number,
        required: [true, 'Value is required']
    },
    unit: {
        type: String,
        required: [true, 'Unit is required'],
        trim: true
    },
    timestamp: {
        type: Date,
        required: [true, 'Timestamp is required'],
        default: Date.now,
        index: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    source: {
        type: String,
        enum: ['manual', 'device', 'imported'],
        default: 'manual'
    },
    deviceId: {
        type: String,
        trim: true
    },
    location: {
        latitude: Number,
        longitude: Number,
        name: String
    },
    tags: [{
        type: String,
        trim: true
    }],
    isFasting: {
        type: Boolean,
        default: false
    },
    timeOfDay: {
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'night'],
        default: 'morning'
    },
    beforeMeal: {
        type: Boolean,
        default: false
    },
    afterMeal: {
        type: Boolean,
        default: false
    },
    medicationTaken: {
        type: Boolean,
        default: false
    },
    medicationDetails: String,
    activityLevel: {
        type: String,
        enum: ['resting', 'light', 'moderate', 'heavy'],
        default: 'resting'
    },
    stressLevel: {
        type: Number,
        min: [1, 'Stress level must be at least 1'],
        max: [10, 'Stress level cannot exceed 10']
    },
    sleepHours: {
        type: Number,
        min: [0, 'Sleep hours cannot be negative'],
        max: [24, 'Sleep hours cannot exceed 24']
    },
    customFields: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Indexes
healthMetricSchema.index({ patientId: 1, metricType: 1, timestamp: -1 });
healthMetricSchema.index({ patientId: 1, timestamp: -1 });
healthMetricSchema.index({ metricType: 1, timestamp: -1 });

// Virtual for formatted timestamp
healthMetricSchema.virtual('formattedTimestamp').get(function () {
    if (!this.timestamp) return null;
    return this.timestamp.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// Virtual for date only (for grouping)
healthMetricSchema.virtual('date').get(function () {
    if (!this.timestamp) return null;
    return this.timestamp.toISOString().split('T')[0];
});

// Virtual for time only
healthMetricSchema.virtual('time').get(function () {
    if (!this.timestamp) return null;
    return this.timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
});

// Virtual for formatted value with unit
healthMetricSchema.virtual('formattedValue').get(function () {
    if (this.value === undefined || this.value === null) return null;

    let formattedValue = this.value;

    // Format based on metric type
    switch (this.metricType) {
        case constants.HEALTH_METRICS.BLOOD_PRESSURE:
            // Assuming value is stored as systolic/diastolic string
            return this.value;

        case constants.HEALTH_METRICS.HEART_RATE:
            return `${Math.round(this.value)} ${this.unit}`;

        case constants.HEALTH_METRICS.WEIGHT:
            return `${this.value.toFixed(1)} ${this.unit}`;

        case constants.HEALTH_METRICS.GLUCOSE:
            return `${this.value} ${this.unit}`;

        case constants.HEALTH_METRICS.TEMPERATURE:
            return `${this.value.toFixed(1)} ${this.unit}`;

        default:
            return `${this.value} ${this.unit}`;
    }
});

// Virtual for health status based on metric
healthMetricSchema.virtual('healthStatus').get(function () {
    if (this.value === undefined || this.value === null) return 'unknown';

    switch (this.metricType) {
        case constants.HEALTH_METRICS.BLOOD_PRESSURE:
            // Parse systolic/diastolic values
            const [systolic, diastolic] = this.value.toString().split('/').map(Number);

            if (systolic < 90 || diastolic < 60) return 'low';
            if (systolic >= 90 && systolic <= 120 && diastolic >= 60 && diastolic <= 80) return 'normal';
            if (systolic >= 121 && systolic <= 129 && diastolic >= 81 && diastolic <= 84) return 'elevated';
            if (systolic >= 130 && systolic <= 139 && diastolic >= 85 && diastolic <= 89) return 'high_stage1';
            if (systolic >= 140 || diastolic >= 90) return 'high_stage2';
            if (systolic >= 180 || diastolic >= 120) return 'crisis';
            return 'unknown';

        case constants.HEALTH_METRICS.HEART_RATE:
            if (this.value < 60) return 'low';
            if (this.value >= 60 && this.value <= 100) return 'normal';
            if (this.value > 100) return 'high';
            return 'unknown';

        case constants.HEALTH_METRICS.GLUCOSE:
            if (this.unit === 'mg/dL') {
                if (this.isFasting) {
                    if (this.value < 70) return 'low';
                    if (this.value >= 70 && this.value <= 99) return 'normal';
                    if (this.value >= 100 && this.value <= 125) return 'prediabetes';
                    if (this.value >= 126) return 'diabetes';
                } else {
                    if (this.value < 70) return 'low';
                    if (this.value >= 70 && this.value <= 140) return 'normal';
                    if (this.value >= 141 && this.value <= 199) return 'prediabetes';
                    if (this.value >= 200) return 'diabetes';
                }
            }
            return 'unknown';

        case constants.HEALTH_METRICS.TEMPERATURE:
            if (this.unit === 'C') {
                if (this.value < 36.1) return 'low';
                if (this.value >= 36.1 && this.value <= 37.2) return 'normal';
                if (this.value >= 37.3 && this.value <= 38.0) return 'elevated';
                if (this.value >= 38.1 && this.value <= 39.0) return 'fever';
                if (this.value > 39.0) return 'high_fever';
            } else if (this.unit === 'F') {
                if (this.value < 97.0) return 'low';
                if (this.value >= 97.0 && this.value <= 99.0) return 'normal';
                if (this.value >= 99.1 && this.value <= 100.4) return 'elevated';
                if (this.value >= 100.5 && this.value <= 102.2) return 'fever';
                if (this.value > 102.2) return 'high_fever';
            }
            return 'unknown';

        default:
            return 'unknown';
    }
});

// Virtual for status color
healthMetricSchema.virtual('statusColor').get(function () {
    const status = this.healthStatus;

    switch (status) {
        case 'normal':
            return 'success';
        case 'low':
        case 'elevated':
        case 'prediabetes':
            return 'warning';
        case 'high':
        case 'high_stage1':
        case 'high_stage2':
        case 'diabetes':
        case 'fever':
            return 'danger';
        case 'crisis':
        case 'high_fever':
            return 'danger'; // Could use a different color for critical
        default:
            return 'secondary';
    }
});

// Virtual for status message
healthMetricSchema.virtual('statusMessage').get(function () {
    const status = this.healthStatus;

    const messages = {
        'normal': 'Normal',
        'low': 'Low',
        'elevated': 'Elevated',
        'prediabetes': 'Prediabetes range',
        'high': 'High',
        'high_stage1': 'High (Stage 1)',
        'high_stage2': 'High (Stage 2)',
        'diabetes': 'Diabetes range',
        'fever': 'Fever',
        'high_fever': 'High fever',
        'crisis': 'Hypertensive crisis - Seek medical attention'
    };

    return messages[status] || 'Unknown status';
});

// Method to check if value is within normal range
healthMetricSchema.methods.isNormal = function () {
    return this.healthStatus === 'normal';
};

// Method to check if value requires attention
healthMetricSchema.methods.requiresAttention = function () {
    const status = this.healthStatus;
    return status === 'low' || status === 'high' || status === 'elevated' ||
        status === 'prediabetes' || status === 'high_stage1' ||
        status === 'high_stage2' || status === 'diabetes' ||
        status === 'fever' || status === 'high_fever';
};

// Method to check if value is critical
healthMetricSchema.methods.isCritical = function () {
    const status = this.healthStatus;
    return status === 'crisis' || status === 'high_fever';
};

// Static method to get statistics for a patient
healthMetricSchema.statics.getStatistics = async function (patientId, metricType, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await this.find({
        patientId,
        metricType,
        timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });

    if (metrics.length === 0) {
        return {
            count: 0,
            average: null,
            min: null,
            max: null,
            latest: null,
            trend: 'stable'
        };
    }

    const values = metrics.map(m => {
        // Handle blood pressure specially
        if (metricType === constants.HEALTH_METRICS.BLOOD_PRESSURE) {
            const [systolic] = m.value.toString().split('/').map(Number);
            return systolic;
        }
        return m.value;
    });

    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1];

    // Calculate trend (simple linear regression)
    let trend = 'stable';
    if (values.length >= 2) {
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const changePercent = ((avgSecond - avgFirst) / avgFirst) * 100;

        if (changePercent > 5) trend = 'increasing';
        else if (changePercent < -5) trend = 'decreasing';
        else trend = 'stable';
    }

    return {
        count: metrics.length,
        average: parseFloat(average.toFixed(2)),
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        latest: parseFloat(latest.toFixed(2)),
        trend
    };
};

// Static method to get daily averages
healthMetricSchema.statics.getDailyAverages = async function (patientId, metricType, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.aggregate([
        {
            $match: {
                patientId: mongoose.Types.ObjectId(patientId),
                metricType,
                timestamp: { $gte: startDate }
            }
        },
        {
            $project: {
                date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                value: 1
            }
        },
        {
            $group: {
                _id: "$date",
                average: { $avg: "$value" },
                count: { $sum: 1 },
                min: { $min: "$value" },
                max: { $max: "$value" }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]);

    return result;
};

const HealthMetric = mongoose.model('HealthMetric', healthMetricSchema);

module.exports = HealthMetric;