class ApiError extends Error {
    constructor(statusCode, message, errorCode = 'OPERATIONAL_ERROR', details = []) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ApiError;