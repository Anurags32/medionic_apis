const constants = require('../config/constants');

// Generate random string
exports.generateRandomString = (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Generate numeric OTP
exports.generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return otp;
};

// Format date to readable string
exports.formatDate = (date, format = 'long') => {
    if (!date) return null;

    const d = new Date(date);

    if (format === 'long') {
        return d.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else if (format === 'short') {
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } else if (format === 'iso') {
        return d.toISOString().split('T')[0];
    } else if (format === 'datetime') {
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    return d.toString();
};

// Format time
exports.formatTime = (time) => {
    if (!time) return null;

    if (typeof time === 'string' && time.includes(':')) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    return time;
};

// Calculate age from date of birth
exports.calculateAge = (dob) => {
    if (!dob) return null;

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
};

// Calculate time difference
exports.timeDifference = (date1, date2) => {
    const diffMs = Math.abs(new Date(date2) - new Date(date1));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
        days: diffDays,
        hours: diffHours,
        minutes: diffMinutes,
        totalMinutes: Math.floor(diffMs / (1000 * 60)),
        totalHours: Math.floor(diffMs / (1000 * 60 * 60)),
        totalDays: diffDays
    };
};

// Format currency
exports.formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

// Format file size
exports.formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Sanitize input
exports.sanitizeInput = (input) => {
    if (typeof input === 'string') {
        return input
            .trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
    return input;
};

// Validate and parse JSON
exports.safeParseJSON = (jsonString) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        return null;
    }
};

// Deep clone object
exports.deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};

// Merge objects
exports.mergeObjects = (target, source) => {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
        Object.keys(source).forEach(key => {
            if (this.isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = this.mergeObjects(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

// Check if value is object
exports.isObject = (item) => {
    return item && typeof item === 'object' && !Array.isArray(item);
};

// Generate pagination metadata
exports.generatePagination = (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
    };
};

// Generate search query
exports.generateSearchQuery = (searchTerm, fields) => {
    if (!searchTerm || !fields || fields.length === 0) {
        return {};
    }

    const searchRegex = new RegExp(searchTerm, 'i');
    const orConditions = fields.map(field => ({
        [field]: { $regex: searchRegex }
    }));

    return { $or: orConditions };
};

// Generate filter query
exports.generateFilterQuery = (filters) => {
    const query = {};

    if (!filters || typeof filters !== 'object') {
        return query;
    }

    Object.keys(filters).forEach(key => {
        const value = filters[key];

        if (value !== undefined && value !== null && value !== '') {
            // Handle date range filters
            if (key.endsWith('From') || key.endsWith('To')) {
                const field = key.replace(/From$|To$/, '');
                const operator = key.endsWith('From') ? '$gte' : '$lte';

                if (!query[field]) {
                    query[field] = {};
                }

                query[field][operator] = new Date(value);
            }
            // Handle array filters
            else if (Array.isArray(value) && value.length > 0) {
                query[key] = { $in: value };
            }
            // Handle boolean filters
            else if (typeof value === 'boolean') {
                query[key] = value;
            }
            // Handle numeric filters with range
            else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
                query[key] = {
                    $gte: value.min,
                    $lte: value.max
                };
            }
            // Handle exact match
            else {
                query[key] = value;
            }
        }
    });

    return query;
};

// Generate sort object
exports.generateSort = (sortBy, sortOrder = 'desc') => {
    if (!sortBy) {
        return { createdAt: -1 };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    return sort;
};

// Calculate distance between coordinates (Haversine formula)
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
};

// Generate tracking number
exports.generateTrackingNumber = () => {
    const prefix = 'TRK';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${year}${month}${random}`;
};

// Generate prescription number
exports.generatePrescriptionNumber = () => {
    const prefix = 'RX';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}${year}${month}${random}`;
};

// Generate appointment ID
exports.generateAppointmentId = () => {
    const prefix = 'APT';
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${year}${month}${random}`;
};

// Mask sensitive data
exports.maskData = (data, visibleChars = 4) => {
    if (!data || typeof data !== 'string') return data;

    const length = data.length;
    if (length <= visibleChars * 2) {
        return '*'.repeat(length);
    }

    const firstPart = data.substring(0, visibleChars);
    const lastPart = data.substring(length - visibleChars);
    const maskedPart = '*'.repeat(length - (visibleChars * 2));

    return firstPart + maskedPart + lastPart;
};

// Validate and format blood pressure
exports.formatBloodPressure = (systolic, diastolic) => {
    if (!systolic || !diastolic) return null;

    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);

    if (isNaN(sys) || isNaN(dia)) return null;
    if (sys <= 0 || dia <= 0) return null;
    if (sys < dia) return null;

    return `${sys}/${dia}`;
};

// Calculate BMI
exports.calculateBMI = (weight, height, weightUnit = 'kg', heightUnit = 'cm') => {
    if (!weight || !height) return null;

    let weightKg = weight;
    let heightM = height;

    // Convert weight to kg
    if (weightUnit === 'lbs') {
        weightKg = weight * 0.453592;
    }

    // Convert height to meters
    if (heightUnit === 'cm') {
        heightM = height / 100;
    } else if (heightUnit === 'inches') {
        heightM = height * 0.0254;
    }

    if (heightM <= 0) return null;

    const bmi = weightKg / (heightM * heightM);
    return parseFloat(bmi.toFixed(1));
};

// Get BMI category
exports.getBMICategory = (bmi) => {
    if (!bmi) return null;

    if (bmi < 18.5) return 'Underweight';
    if (bmi >= 18.5 && bmi < 25) return 'Normal weight';
    if (bmi >= 25 && bmi < 30) return 'Overweight';
    return 'Obese';
};