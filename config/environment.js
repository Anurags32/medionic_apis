const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

module.exports = {
    // Server configuration
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5000,

    // Database configuration
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db',

    // JWT configuration
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '7d',
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '30d',

    // Email configuration
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: process.env.SMTP_PORT || 587,
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'healthcare@example.com',

    // Client URL for CORS
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',

    // File upload configuration
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // Security
    SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret-change-this',

    // API Keys (if needed for external services)
    // GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    // TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    // TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,

    // Feature flags
    ENABLE_EMAIL_VERIFICATION: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
    ENABLE_SMS_NOTIFICATIONS: process.env.ENABLE_SMS_NOTIFICATIONS === 'true',
    ENABLE_FILE_UPLOADS: process.env.ENABLE_FILE_UPLOADS === 'true'
};

// Validate required environment variables
const validateEnvironment = () => {
    const required = ['JWT_SECRET'];
    const missing = [];

    required.forEach(key => {
        if (!process.env[key]) {
            missing.push(key);
        }
    });

    if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        console.error('Please set these variables in your .env file');
        process.exit(1);
    }
};

// Run validation in production
if (process.env.NODE_ENV === 'production') {
    validateEnvironment();
}