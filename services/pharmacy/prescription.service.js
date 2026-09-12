const { Prescription, Customer, User } = require('../../models/pharmacy');
const ApiError = require('../../utils/ApiError');
const { PRESCRIPTION_STATUS } = require('../../config/pharmacyConstants');
const { emitToBranch } = require('../../socket/pharmacyEvents');


const uploadPrescription = async (branchId, payload, file) => {
    if (!file) {
        throw new ApiError(400, 'Prescription image or document file is required', 'FILE_REQUIRED');
    }

    const {
        customer_id,
        patient_name,
        patient_age,
        patient_gender,
        doctor_name,
        doctor_reg_no,
        diagnosis,
        items_prescribed,
    } = payload;

    const fileUrl = `/uploads/prescriptions/${file.filename}`;

    const prescription = await Prescription.create({
        branch_id: branchId,
        customer_id: customer_id || null,
        patient_name: patient_name || 'Walk-in Patient',
        patient_age: patient_age || null,
        patient_gender: patient_gender || null,
        doctor_name: doctor_name || 'Doctor',
        doctor_reg_no: doctor_reg_no || null,
        diagnosis: diagnosis || null,
        items_prescribed: items_prescribed || [],
        file_url: fileUrl,
        status: PRESCRIPTION_STATUS.PENDING,
    });

    emitToBranch(branchId, 'prescription:uploaded', {
        prescriptionId: prescription._id.toString(),
        patientName: prescription.patient_name,
        fileUrl: prescription.file_url,
        message: `📋 New prescription uploaded for ${prescription.patient_name}`,
    });

    return prescription;
};

const getPrescriptions = async (branchId, query = {}) => {
    const { status, customer_id, page = 1, limit = 20 } = query;
    const filter = { branch_id: branchId };

    if (status) {
        filter.status = status;
    }
    if (customer_id) {
        filter.customer_id = customer_id;
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [prescriptions, total] = await Promise.all([
        Prescription.find(filter)
            .populate('customer', 'name phone email')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limitNum),
        Prescription.countDocuments(filter),
    ]);

    return {
        prescriptions,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum) || 1,
        },
    };
};

const getPrescriptionById = async (branchId, prescriptionId) => {
    const rx = await Prescription.findOne({
        _id: prescriptionId,
        branch_id: branchId,
    }).populate('customer');

    if (!rx) {
        throw new ApiError(404, 'Prescription not found in this branch', 'PRESCRIPTION_NOT_FOUND');
    }

    return rx;
};

const verifyPrescription = async (branchId, pharmacistId, prescriptionId, status, rejectionReason = null) => {
    const rx = await Prescription.findOne({
        _id: prescriptionId,
        branch_id: branchId,
    });

    if (!rx) {
        throw new ApiError(404, 'Prescription not found', 'PRESCRIPTION_NOT_FOUND');
    }

    if (![PRESCRIPTION_STATUS.VERIFIED, PRESCRIPTION_STATUS.DISPENSED, PRESCRIPTION_STATUS.REJECTED].includes(status)) {
        throw new ApiError(400, 'Invalid prescription status for verification', 'INVALID_STATUS');
    }

    rx.status = status;
    rx.diagnosis = rejectionReason ? `Rejection: ${rejectionReason}` : rx.diagnosis;
    await rx.save();

    emitToBranch(branchId, 'prescription:verified', {
        prescriptionId: rx._id.toString(),
        status: rx.status,
        verifiedBy: pharmacistId,
        message: `Prescription #${rx._id.toString()} has been marked as ${status}`,
    });

    return rx;
};

module.exports = {
    uploadPrescription,
    getPrescriptions,
    getPrescriptionById,
    verifyPrescription,
};
