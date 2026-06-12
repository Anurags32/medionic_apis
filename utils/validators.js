const constants = require('../config/constants');

// Email validation
exports.isValidEmail = (email) => {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
};

// Password validation
exports.isValidPassword = (password) => {
    const minLength = constants.PASSWORD.MIN_LENGTH;
    const hasUpperCase = constants.PASSWORD.REQUIRE_UPPERCASE ? /[A-Z]/.test(password) : true;
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = constants.PASSWORD.REQUIRE_NUMBER ? /\d/.test(password) : true;
    const hasSpecialChar = constants.PASSWORD.REQUIRE_SPECIAL_CHAR ? /[@$!%*?&]/.test(password) : true;

    return password.length >= minLength &&
        hasUpperCase &&
        hasLowerCase &&
        hasNumbers &&
        hasSpecialChar;
};

// Phone number validation (international format)
exports.isValidPhone = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};

// ZIP code validation (US format)
exports.isValidZipCode = (zip) => {
    const zipRegex = /^\d{5,6}(-\d{4})?$/;
    return zipRegex.test(zip);
};

// Date validation
exports.isValidDate = (date) => {
    return !isNaN(Date.parse(date));
};

// Date of birth validation (must be in the past)
exports.isValidDOB = (dob) => {
    const date = new Date(dob);
    const today = new Date();
    return date < today;
};

// Age validation
exports.isValidAge = (dob, minAge = 0, maxAge = 150) => {
    if (!exports.isValidDOB(dob)) return false;

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age >= minAge && age <= maxAge;
};

// Blood pressure validation (systolic/diastolic format)
exports.isValidBloodPressure = (bp) => {
    if (typeof bp !== 'string') return false;

    const parts = bp.split('/');
    if (parts.length !== 2) return false;

    const systolic = parseInt(parts[0], 10);
    const diastolic = parseInt(parts[1], 10);

    if (isNaN(systolic) || isNaN(diastolic)) return false;
    if (systolic <= 0 || diastolic <= 0) return false;
    if (systolic < diastolic) return false;

    return systolic >= 40 && systolic <= 300 && diastolic >= 20 && diastolic <= 200;
};

// Time validation (HH:MM format)
exports.isValidTime = (time) => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
};

// URL validation
exports.isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
};

// File size validation
exports.isValidFileSize = (size, maxSize = constants.FILE_UPLOAD.MAX_SIZE) => {
    return size <= maxSize;
};

// File type validation
exports.isValidFileType = (mimeType, allowedTypes = constants.FILE_UPLOAD.ALLOWED_TYPES) => {
    return allowedTypes.includes(mimeType);
};

// Array validation
exports.isNonEmptyArray = (array) => {
    return Array.isArray(array) && array.length > 0;
};

// Object validation
exports.isNonEmptyObject = (obj) => {
    return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
};

// Number range validation
exports.isInRange = (value, min, max) => {
    return value >= min && value <= max;
};

// Rating validation (1-5)
exports.isValidRating = (rating) => {
    return exports.isInRange(rating, 1, 5);
};

// Consultation fee validation
exports.isValidConsultationFee = (fee) => {
    return fee >= 0 && fee <= 10000; // Assuming max fee is 10000
};

// Years of experience validation
exports.isValidYearsExperience = (years) => {
    return years >= 0 && years <= 80; // Assuming max experience is 80 years
};

// Quantity validation
exports.isValidQuantity = (quantity) => {
    return quantity >= 1 && quantity <= 1000; // Assuming max quantity is 1000
};

// Price validation
exports.isValidPrice = (price) => {
    return price >= 0 && price <= 100000; // Assuming max price is 100000
};

// Percentage validation
exports.isValidPercentage = (percentage) => {
    return percentage >= 0 && percentage <= 100;
};

// Validate consultation type
exports.isValidConsultationType = (type) => {
    return Object.values(constants.CONSULTATION_TYPES).includes(type);
};

// Validate user role
exports.isValidUserRole = (role) => {
    return Object.values(constants.ROLES).includes(role);
};

// Validate appointment status
exports.isValidAppointmentStatus = (status) => {
    return Object.values(constants.APPOINTMENT_STATUS).includes(status);
};

// Validate prescription status
exports.isValidPrescriptionStatus = (status) => {
    return Object.values(constants.PRESCRIPTION_STATUS).includes(status);
};

// Validate order status
exports.isValidOrderStatus = (status) => {
    return Object.values(constants.ORDER_STATUS).includes(status);
};

// Validate payment method
exports.isValidPaymentMethod = (method) => {
    return Object.values(constants.PAYMENT_METHODS).includes(method);
};

// Validate health metric type
exports.isValidHealthMetricType = (type) => {
    return Object.values(constants.HEALTH_METRICS).includes(type);
};

// Validate file category
exports.isValidFileCategory = (category) => {
    return Object.values(constants.FILE_CATEGORIES).includes(category);
};

// Generate validation error message
exports.getValidationErrorMessage = (field, value, validator) => {
    const messages = {
        email: `'${value}' is not a valid email address`,
        password: 'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
        phone: `'${value}' is not a valid phone number`,
        zip: `'${value}' is not a valid ZIP code`,
        date: `'${value}' is not a valid date`,
        dob: `'${value}' is not a valid date of birth`,
        age: `Age must be between ${validator.minAge} and ${validator.maxAge}`,
        bloodPressure: `'${value}' is not a valid blood pressure reading`,
        time: `'${value}' is not a valid time (HH:MM format)`,
        url: `'${value}' is not a valid URL`,
        fileSize: 'File size exceeds maximum allowed size',
        fileType: 'File type is not allowed',
        array: 'Array cannot be empty',
        object: 'Object cannot be empty',
        range: `Value must be between ${validator.min} and ${validator.max}`,
        rating: 'Rating must be between 1 and 5',
        consultationFee: 'Consultation fee must be between 0 and 10000',
        yearsExperience: 'Years of experience must be between 0 and 80',
        quantity: 'Quantity must be between 1 and 1000',
        price: 'Price must be between 0 and 100000',
        percentage: 'Percentage must be between 0 and 100',
        consultationType: `'${value}' is not a valid consultation type`,
        userRole: `'${value}' is not a valid user role`,
        appointmentStatus: `'${value}' is not a valid appointment status`,
        prescriptionStatus: `'${value}' is not a valid prescription status`,
        orderStatus: `'${value}' is not a valid order status`,
        paymentMethod: `'${value}' is not a valid payment method`,
        healthMetricType: `'${value}' is not a valid health metric type`,
        fileCategory: `'${value}' is not a valid file category`
    };

    return messages[field] || `'${value}' is not valid for ${field}`;
};