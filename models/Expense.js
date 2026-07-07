const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    mrId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'MR ID is required']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    category: {
        type: String,
        required: [true, 'Expense category is required']
    },
    expenseType: {
        type: String
    },
    date: {
        type: Date,
        required: [true, 'Expense date is required']
    },
    description: {
        type: String,
        trim: true
    },
    receiptUrl: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    remarks: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

expenseSchema.pre('save', function (next) {
    if (this.expenseType && !this.category) {
        this.category = this.expenseType;
    } else if (this.category && !this.expenseType) {
        this.expenseType = this.category;
    }
    if (this.approvalStatus && !this.status) {
        this.status = this.approvalStatus;
    } else if (this.status && !this.approvalStatus) {
        this.approvalStatus = this.status;
    }
    next();
});

expenseSchema.index({ mrId: 1 });
expenseSchema.index({ status: 1 });
expenseSchema.index({ approvalStatus: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
