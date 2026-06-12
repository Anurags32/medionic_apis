const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const constants = require('../config/constants');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters']
    },
    role: {
        type: String,
        enum: Object.values(constants.ROLES),
        default: constants.ROLES.PATIENT,
        required: [true, 'Role is required']
    },
    status: {
        type: String,
        enum: Object.values(constants.USER_STATUS),
        default: constants.USER_STATUS.ACTIVE
    },
    profileComplete: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: {
        type: Date,
        default: Date.now
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date
}, {
    timestamps: true
});

// Indexes for better performance
// `email` is already marked `unique` in the schema; avoid duplicate index declaration.
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to generate reset token (simplified)
userSchema.methods.getResetPasswordToken = function () {
    // Generate a random token (in production, use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Hash token and set to resetPasswordToken field
    this.resetPasswordToken = resetToken;

    // Set expire (1 hour from now)
    this.resetPasswordExpire = Date.now() + 3600000; // 1 hour

    return resetToken;
};

// Method to generate email verification token
userSchema.methods.getEmailVerificationToken = function () {
    const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    this.emailVerificationToken = verificationToken;
    this.emailVerificationExpire = Date.now() + 86400000; // 24 hours

    return verificationToken;
};

// Method to check if user is active
userSchema.methods.isActive = function () {
    return this.status === constants.USER_STATUS.ACTIVE;
};

// Virtual for full name (if available from profile)
userSchema.virtual('fullName').get(function () {
    // This will be populated from profile models
    return null;
});

// Remove password from JSON response
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.resetPasswordToken;
    delete obj.resetPasswordExpire;
    delete obj.emailVerificationToken;
    delete obj.emailVerificationExpire;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;