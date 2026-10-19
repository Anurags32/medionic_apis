const ApiError = require('../../utils/ApiError');


const rateLimiter = ({ windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests, please try again later.' } = {}) => {
    const requests = new Map();

    const interval = setInterval(() => {
        const now = Date.now();
        for (const [ip, data] of requests.entries()) {
            if (now - data.startTime > windowMs) {
                requests.delete(ip);
            }
        }
    }, windowMs);

    if (interval.unref) interval.unref();

    return (req, res, next) => {
        if (process.env.NODE_ENV !== 'production') {
            return next();
        }
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
        const now = Date.now();

        let clientData = requests.get(ip);
        if (!clientData || now - clientData.startTime > windowMs) {
            clientData = {
                count: 1,
                startTime: now,
            };
            requests.set(ip, clientData);
            return next();
        }

        clientData.count += 1;

        if (clientData.count > max) {
            return next(new ApiError(429, message, 'RATE_LIMIT_EXCEEDED'));
        }

        next();
    };
};

const authLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

const otpLimiter = rateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: 'Too many OTP requests from this IP. Please wait 5 minutes before trying again.',
});

module.exports = {
    rateLimiter,
    authLimiter,
    otpLimiter,
};
