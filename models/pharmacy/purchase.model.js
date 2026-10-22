const mongoose = require('mongoose');

const PURCHASE_PAYMENT_STATUS = ['UNPAID', 'PARTIAL', 'PAID'];
const PURCHASE_PAYMENT_MODES = ['CASH', 'UPI', 'BANK', 'CHEQUE', 'CREDIT'];

/** One line of a supplier bill; free goods add stock but are not charged. */
const purchaseItemSchema = new mongoose.Schema(
    {
        medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
        batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicineBatch', required: true },
        medicine_name: { type: String, default: '' },
        hsn_code: { type: String, default: '' },
        batch_number: { type: String, required: true },
        expiry_date: { type: Date, required: true },
        mfg_date: { type: Date, default: null },
        quantity: { type: Number, required: true, min: 1 },
        free_quantity: { type: Number, default: 0, min: 0 },
        purchase_rate: { type: Number, required: true, min: 0 },
        mrp: { type: Number, required: true, min: 0 },
        sale_price: { type: Number, default: 0, min: 0 },
        gst_rate: { type: Number, default: 12, min: 0 },
        discount_percent: { type: Number, default: 0, min: 0, max: 100 },
        line_subtotal: { type: Number, default: 0 },
        discount_amount: { type: Number, default: 0 },
        taxable_amount: { type: Number, default: 0 },
        gst_amount: { type: Number, default: 0 },
        line_total: { type: Number, default: 0 },
    },
    { _id: false }
);

const purchasePaymentSchema = new mongoose.Schema(
    {
        amount: { type: Number, required: true, min: 0 },
        mode: { type: String, enum: PURCHASE_PAYMENT_MODES, default: 'CASH' },
        reference: { type: String, default: '' },
        note: { type: String, default: '' },
        paid_at: { type: Date, default: Date.now },
        created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyStaff', default: null },
    },
    { _id: true }
);

/**
 * Supplier bill (purchase entry). Creating one inwards every line into a
 * batch and logs PURCHASE_IN; payments reduce balance_due (payables).
 */
const purchaseSchema = new mongoose.Schema(
    {
        branch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
        supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
        supplier_name: { type: String, default: '' },
        purchase_number: { type: String, required: true },
        supplier_invoice_number: { type: String, trim: true, default: '' },
        invoice_date: { type: Date, default: Date.now, index: true },
        items: { type: [purchaseItemSchema], default: [] },
        subtotal: { type: Number, default: 0 },
        discount_amount: { type: Number, default: 0 },
        taxable_amount: { type: Number, default: 0 },
        cgst: { type: Number, default: 0 },
        sgst: { type: Number, default: 0 },
        total_tax: { type: Number, default: 0 },
        grand_total: { type: Number, default: 0 },
        amount_paid: { type: Number, default: 0 },
        balance_due: { type: Number, default: 0 },
        payment_status: { type: String, enum: PURCHASE_PAYMENT_STATUS, default: 'UNPAID', index: true },
        payments: { type: [purchasePaymentSchema], default: [] },
        notes: { type: String, default: '' },
        // CANCELLED bills have had their stock reversed and count for nothing.
        status: { type: String, enum: ['RECEIVED', 'CANCELLED'], default: 'RECEIVED', index: true },
        cancel_reason: { type: String, default: '' },
        cancelled_at: { type: Date, default: null },
        cancelled_by_name: { type: String, default: '' },
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

purchaseSchema.index({ branch_id: 1, purchase_number: 1 }, { unique: true });
purchaseSchema.index({ branch_id: 1, invoice_date: -1 });

purchaseSchema.virtual('item_count').get(function () {
    return (this.items || []).length;
});

const Purchase = mongoose.model('Purchase', purchaseSchema);
Purchase.PAYMENT_STATUS = PURCHASE_PAYMENT_STATUS;
Purchase.PAYMENT_MODES = PURCHASE_PAYMENT_MODES;

module.exports = Purchase;
