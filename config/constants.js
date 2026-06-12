module.exports = {
    // User roles
    ROLES: {
        PATIENT: 'patient',
        DOCTOR: 'doctor',
        MR: 'mr',
        ADMIN: 'admin'
    },

    // User status
    USER_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        SUSPENDED: 'suspended'
    },

    // Appointment status
    APPOINTMENT_STATUS: {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },

    // Prescription status
    PRESCRIPTION_STATUS: {
        ACTIVE: 'active',
        COMPLETED: 'completed',
        EXPIRED: 'expired'
    },

    // Order status
    ORDER_STATUS: {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        SHIPPED: 'shipped',
        DELIVERED: 'delivered'
    },

    // Payment methods
    PAYMENT_METHODS: {
        COD: 'COD',
        CARD: 'Card',
        UPI: 'UPI'
    },

    // Consultation types
    CONSULTATION_TYPES: {
        VIDEO: 'video',
        CHAT: 'chat',
        CLINIC: 'clinic'
    },

    // Verification status
    VERIFICATION_STATUS: {
        PENDING: 'pending',
        VERIFIED: 'verified',
        REJECTED: 'rejected'
    },

    // Meeting status
    MEETING_STATUS: {
        PENDING: 'pending',
        APPROVED: 'approved',
        REJECTED: 'rejected',
        COMPLETED: 'completed'
    },

    // Health metric types
    HEALTH_METRICS: {
        BLOOD_PRESSURE: 'BP',
        HEART_RATE: 'HR',
        WEIGHT: 'Weight',
        GLUCOSE: 'Glucose',
        TEMPERATURE: 'Temperature'
    },

    // File categories for medical records
    FILE_CATEGORIES: {
        LAB_REPORT: 'lab_report',
        TEST_RESULT: 'test_result',
        PRESCRIPTION: 'prescription'
    },

    // JWT configuration
    JWT: {
        ACCESS_TOKEN_EXPIRY: '7d',
        REFRESH_TOKEN_EXPIRY: '30d',
        RESET_TOKEN_EXPIRY: '1h'
    },

    // Password requirements
    PASSWORD: {
        MIN_LENGTH: 8,
        REQUIRE_UPPERCASE: true,
        REQUIRE_NUMBER: true,
        REQUIRE_SPECIAL_CHAR: true
    },

    // File upload limits
    FILE_UPLOAD: {
        MAX_SIZE: 5 * 1024 * 1024, // 5MB
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    },

    // Pagination defaults
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100
    }
};