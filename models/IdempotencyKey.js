const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
    key: { type: String, required: true, trim: true },
    scope: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { type: String, enum: ['processing', 'completed'], default: 'processing' },
    statusCode: Number,
    responseBody: mongoose.Schema.Types.Mixed,
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

idempotencyKeySchema.index({ key: 1, scope: 1 }, { unique: true });
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);