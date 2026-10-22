const mongoose = require('mongoose');

const RETURN_SETTLEMENTS = ['ADJUST_PAYABLE', 'REFUND', 'PENDING'];

const purchaseReturnItemSchema = new mongoose.Schema(
    {
        medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
        batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicineBatch', required: true },
        medicine_name: { type: String, default: '' },
        batch_number: { type: String, default: '' },
        expiry_date: { type: Date, default: null },
        quantity: { type: Number, required: true, min: 1 },
        purchase_rate: { type: Number, required: true, min: 0 },
        gst_rate: { type: Number, default: 12, min: 0 },
        taxable_amount: { type: Number, default: 0 },
        gst_amount: { type: Number, default: 0 },
        line_total: { type: Number, default: 0 },
    },
    { _id: false }
);

/**
 * Debit note: stock sent back to a supplier (expiry, damage, wrong item).
 * Stock leaves the batch immediately; the value is adjusted against the
 * linked bill's dues, refunded, or left pending for a supplier credit note.
 */
const purchaseReturnSchema = new mongoose.Schema(
    {
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
        supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
        supplier_name: { type: String, default: '' },
        purchase_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null, index: true },
        purchase_number: { type: String, default: '' },
        debit_note_number: { type: String, required: true },
        return_date: { type: Date, default: Date.now, index: true },
        reason: { type: String, default: '' },
        items: { type: [purchaseReturnItemSchema], default: [] },
        subtotal: { type: Number, default: 0 },
        total_tax: { type: Number, default: 0 },
        grand_total: { type: Number, default: 0 },
        settlement: { type: String, enum: RETURN_SETTLEMENTS, default: 'PENDING' },
        adjusted_amount: { type: Number, default: 0 }, // knocked off the linked bill's due
        notes: { type: String, default: '' },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyStaff', default: null },
        created_by_name: { type: String, default: '' },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

purchaseReturnSchema.index({ branch_id: 1, debit_note_number: 1 }, { unique: true });

const PurchaseReturn = mongoose.model('PurchaseReturn', purchaseReturnSchema);
PurchaseReturn.SETTLEMENTS = RETURN_SETTLEMENTS;

module.exports = PurchaseReturn;
