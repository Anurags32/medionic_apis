const jwt = require('jsonwebtoken');
const User = require('../models/User');
const constants = require('../config/constants');
const ErrorResponse = require('../utils/errorResponse');

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || constants.JWT_SECRET);

        // Get user from database
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return next(new ErrorResponse('User not found', 404));
        }

        // Check if user is active
        if (!user.isActive()) {
            return next(new ErrorResponse('User account is not active', 403));
        }

        // Attach user to request object
        req.user = user;
        next();
    } catch (error) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }
};

// Role-based authorization middleware
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ErrorResponse('User not authenticated', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(
                new ErrorResponse(
                    `User role ${req.user.role} is not authorized to access this route`,
                    403
                )
            );
        }

        next();
    };
};

// Check if user profile is complete
exports.profileComplete = async (req, res, next) => {
    if (!req.user) {
        return next(new ErrorResponse('User not authenticated', 401));
    }

    try {
        const user = await User.findById(req.user._id);

        if (!user.profileComplete) {
            return next(new ErrorResponse('Please complete your profile first', 400));
        }

        next();
    } catch (error) {
        return next(new ErrorResponse('Error checking profile completion', 500));
    }
};

// Optional authentication middleware
// This middleware will try to authenticate but won't fail if token is missing
exports.optionalAuth = async (req, res, next) => {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // If no token, continue without authentication
    if (!token) {
        return next();
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || constants.JWT_SECRET);

        // Get user from database
        const user = await User.findById(decoded.id).select('-password');

        if (user && user.isActive()) {
            // Attach user to request object
            req.user = user;
        }

        next();
    } catch (error) {
        // If token is invalid, continue without authentication
        next();
    }
};

// Generate JWT token
exports.generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || constants.JWT_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || constants.JWT.ACCESS_TOKEN_EXPIRY
    });
};

// Generate refresh token
exports.generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || constants.JWT_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || constants.JWT.REFRESH_TOKEN_EXPIRY
    });
};

// Generate reset token
exports.generateResetToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || constants.JWT_SECRET, {
        expiresIn: constants.JWT.RESET_TOKEN_EXPIRY
    });
};