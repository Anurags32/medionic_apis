const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for development
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    // Pharmacy / Operational ApiError
    if (err.errorCode || err.isOperational) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            statusCode,
            message: err.message,
            error: {
                code: err.errorCode || 'REQUEST_ERROR',
                details: err.details || [],
            },
            code: err.errorCode,
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
        });
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = `Resource not found with id of ${err.value}`;
        error = new ErrorResponse(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const value = err.keyValue[field];
        const message = `Duplicate field value entered: ${field} "${value}" already exists`;
        error = new ErrorResponse(message, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        const message = `Validation failed: ${messages.join(', ')}`;
        error = new ErrorResponse(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new ErrorResponse(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new ErrorResponse(message, 401);
    }

    // Multer file upload errors
    if (err.name === 'MulterError') {
        let message = 'File upload error';

        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File size too large';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Invalid file type';
                break;
        }

        error = new ErrorResponse(message, 400);
    }

    // Default to 500 server error
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Server Error';

    // Send error response
    res.status(statusCode).json({
        success: false,
        code: error.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
        message,
        requestId: req.requestId,
        errors: error.errors || [],
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;