const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema(
    {
        branch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true,
        },
        doctor_name: {
            type: String,
            required: true,
            trim: true,
        },
        doctor_reg_no: {
            type: String,
            trim: true,
        },
        patient_name: {
            type: String,
            required: true,
            trim: true,
        },
        patient_age: {
            type: Number,
        },
        patient_gender: {
            type: String,
            enum: ['MALE', 'FEMALE', 'OTHER'],
        },
        prescription_date: {
            type: Date,
            default: Date.now,
        },
        file_url: {
            type: String,
            trim: true,
        },
        diagnosis: {
            type: String,
            trim: true,
        },
        items_prescribed: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },
        status: {
            type: String,
            enum: ['PENDING', 'VERIFIED', 'REJECTED', 'DISPENSED'],
            default: 'PENDING',
        },
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
        toObject: {
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

prescriptionSchema.virtual('customer', {
    ref: 'Customer',
    localField: 'customer_id',
    foreignField: '_id',
    justOne: true,
});

const Prescription = mongoose.models.PharmacyPrescription || mongoose.model('PharmacyPrescription', prescriptionSchema, 'pharmacy_prescriptions');

module.exports = Prescription;

