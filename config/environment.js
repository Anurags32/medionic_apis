const dotenv = require('dotenv');

dotenv.config();

module.exports = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 5001,

    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_db',

    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '7d',
    JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '30d',

    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: process.env.SMTP_PORT || 587,
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    EMAIL_FROM: process.env.EMAIL_FROM || 'healthcare@example.com',

    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',

    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,

    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret-change-this',

    ENABLE_EMAIL_VERIFICATION: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
    ENABLE_SMS_NOTIFICATIONS: process.env.ENABLE_SMS_NOTIFICATIONS === 'true',
    ENABLE_FILE_UPLOADS: process.env.ENABLE_FILE_UPLOADS === 'true'
};

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

if (process.env.NODE_ENV === 'production') {
    validateEnvironment();
}