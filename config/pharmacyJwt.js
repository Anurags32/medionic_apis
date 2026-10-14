const jwt = require('jsonwebtoken');

const generateAccessToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET || 'medcab_jwt_secret', {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });
};

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'medcab_jwt_refresh_secret', {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET || 'medcab_jwt_secret');
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'medcab_jwt_refresh_secret');
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};