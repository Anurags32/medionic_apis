const ApiError = require('../../utils/ApiError');


const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errorCode = err.errorCode || 'INTERNAL_ERROR';
    let details = err.details || [];

    if (err.code === 11000) {
        statusCode = 409;
        errorCode = 'DUPLICATE_ENTRY';
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        message = `A record with this ${field} already exists`;
        details = [{ field, message: `${field} must be unique` }];
    }

    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        details = Object.values(err.errors || {}).map((e) => ({
            field: e.path,
            message: e.message,
        }));
    }

    if (errorCode === 'VALIDATION_ERROR' && details && details.length > 0 && details[0].message) {
        message = details[0].message;
    }

    if (err.name === 'CastError') {
        statusCode = 400;
        errorCode = 'INVALID_ID_FORMAT';
        message = `Invalid ID format for ${err.path}`;
    }

    console.error(`❌ [${errorCode}] ${message}`);
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: details || [],
        error: {
            code: errorCode,
            details: details || [],
        },
        code: errorCode,
        timestamp: new Date().toISOString(),
    });
};

module.exports = errorHandler;