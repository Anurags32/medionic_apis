// middlewares/validate.middleware.js
const { validationResult } = require('express-validator');
const ApiError = require('../../utils/ApiError');


/**
 * Middleware factory to run express-validator chains and handle errors
 * @param {Array} validations
 */
const validate = (validations) => {
    return async (req, res, next) => {
        if (Array.isArray(validations)) {
            for (const validation of validations) {
                const result = await validation.run(req);
                if (result.errors.length) break;
            }
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const formattedErrors = errors.array().map((err) => ({
                field: err.path || err.param,
                message: err.msg,
            }));

            return next(new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', formattedErrors));
        }

        next();
    };
};

module.exports = validate;