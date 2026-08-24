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
        const existing = await IdempotencyKey.findOne({ key, scope });

        if (existing) {
            if (existing.requestHash !== requestHash) {
                return next(new ErrorResponse('Idempotency-Key was reused with a different request', 409));
            }
            if (existing.status === 'processing') {
                return next(new ErrorResponse('A request with this Idempotency-Key is already processing', 409));
            }
            return res.status(existing.statusCode || 200).json(existing.responseBody);
        }

        let record;
        try {
            record = await IdempotencyKey.create({
                key,
                scope,
                requestHash,
                status: 'processing',
                expiresAt
            });
        } catch (insertError) {
            if (insertError.code === 11000) {
                const duplicate = await IdempotencyKey.findOne({ key, scope });
                if (duplicate && duplicate.requestHash !== requestHash) {
                    return next(new ErrorResponse('Idempotency-Key was reused with a different request', 409));
                }
                return next(new ErrorResponse('A request with this Idempotency-Key is already processing', 409));
            }
            throw insertError;
        }

        const originalJson = res.json.bind(res);
        res.json = function (body) {
            res.json = originalJson;

            if (record && record._id) {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    IdempotencyKey.findByIdAndUpdate(record._id, {
                        $set: {
                            status: 'completed',
                            statusCode: res.statusCode,
                            responseBody: body
                        }
                    }).catch(err => {
                        console.error('⚠️  Failed to cache idempotent response:', err.message);
                    });
                } else {
                    // On error (4xx/5xx), remove record so user can retry
                    IdempotencyKey.findByIdAndDelete(record._id).catch(err => {
                        console.error('⚠️  Failed to clear failed idempotent record:', err.message);
                    });
                }
            }

            return originalJson(body);
        };

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = idempotent;