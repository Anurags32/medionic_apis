const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
    medicine_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine',
        required: true,
    },
    medicine_name: {
        type: String,
        trim: true,
    },
    batch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MedicineBatch',
        required: true,
    },
    batch_number: {
        type: String,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    unit_price: {
        type: Number,
        default: 0,
        min: 0,
    },
    total_amount: {
        type: Number,
        default: 0,
        min: 0,
    },
    reason: {
        type: String,
        trim: true,
    },
    condition: {
        type: String,
        enum: ['GOOD', 'SEALED', 'DAMAGED', 'EXPIRED'],
        default: 'GOOD',
    },
    action: {
        type: String,
        enum: ['PENDING', 'RESTOCK', 'DISPOSE'],
        default: 'PENDING',
    },
    restocked_quantity: {
        type: Number,
        default: 0,
    },
    disposed_quantity: {
        type: Number,
        default: 0,
    },
});

const returnSchema = new mongoose.Schema(
    {
        return_number: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        invoice_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Invoice',
        },
        order_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
        },
        customer_name: {
            type: String,
            trim: true,
        },
        customer_phone: {
            type: String,
            trim: true,
        },
        items: [returnItemSchema],
        total_refund_amount: {
            type: Number,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ['PENDING', 'INSPECTED', 'RESTOCKED', 'DISPOSED', 'COMPLETED', 'REJECTED'],
            default: 'PENDING',
            index: true,
        },
        inspection_notes: {
            type: String,
            trim: true,
        },
        inspected_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PharmacyStaff',
        },
        inspected_at: {
            type: Date,
        },
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PharmacyStaff',
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
    }
);

returnSchema.index({ branch_id: 1, status: 1, created_at: -1 });
returnSchema.index({ return_number: 1, branch_id: 1 });

const PharmacyReturn = mongoose.model('PharmacyReturn', returnSchema);
module.exports = PharmacyReturn;
