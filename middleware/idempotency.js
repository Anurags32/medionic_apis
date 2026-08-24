const crypto = require('crypto');
const IdempotencyKey = require('../models/IdempotencyKey');
const ErrorResponse = require('../utils/errorResponse');

const idempotent = (options = {}) => async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    if (!key) return next();
    if (key.length < 8 || key.length > 128) {
        return next(new ErrorResponse('Idempotency-Key must be between 8 and 128 characters', 400));
    }

    const scope = `${req.user?._id || 'anonymous'}:${req.method}:${req.baseUrl}${req.path}`;
    const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
    const expiresAt = new Date(Date.now() + (options.ttlMs || 24 * 60 * 60 * 1000));

    try {
        const record = await IdempotencyKey.findOneAndUpdate(
            { key, scope },
            { $setOnInsert: { key, scope, requestHash, expiresAt } },
            { upsert: true, new: true, rawResult: true }
        );
        const existing = record.lastErrorObject?.updatedExisting ? record.value : null;

        if (existing) {
            if (existing.requestHash !== requestHash) {
                return next(new ErrorResponse('Idempotency-Key was reused with a different request', 409));
            }
            if (existing.status === 'processing') {
                return next(new ErrorResponse('A request with this Idempotency-Key is already processing', 409));
            }
            res.status(existing.statusCode || 200).json(existing.responseBody);
            return;
        }

        const originalJson = res.json.bind(res);
        res.json = async body => {
            await IdempotencyKey.updateOne({ _id: record.value._id }, {
                $set: { status: 'completed', statusCode: res.statusCode, responseBody: body }
            });
            return originalJson(body);
        };
        next();
    } catch (error) {
        if (error.code === 11000) {
            return next(new ErrorResponse('A request with this Idempotency-Key is already processing', 409));
        }
        next(error);
    }
};

module.exports = idempotent;