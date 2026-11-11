const jwt = require('jsonwebtoken');
const constants = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || constants.JWT_SECRET;

function generatePartnerToken(partner) {
    return jwt.sign(
        {
            id: partner._id.toString(),
            partnerId: partner._id.toString(),
            partnerType: partner.partner_type,
            email: partner.email,
            pharmacyId: partner.pharmacy_id ? partner.pharmacy_id.toString() : null,
            tokenVersion: partner.token_version || 1,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function generateRefreshToken(partner) {
    return jwt.sign(
        {
            id: partner._id.toString(),
            tokenVersion: partner.token_version || 1,
        },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

module.exports = {
    generatePartnerToken,
    generateRefreshToken,
};

