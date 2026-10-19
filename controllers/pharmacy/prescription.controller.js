const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
const prescriptionService = require('../../services/pharmacy/prescription.service');


const upload = asyncHandler(async (req, res) => {
    const file = req.file || (req.files && (req.files['prescription_image']?.[0] || req.files['prescription']?.[0]));
    const rx = await prescriptionService.uploadPrescription(req.user.branchId, req.body, file);
    res.status(201).json(new ApiResponse(201, rx, 'Prescription uploaded successfully'));
});

const getPrescriptions = asyncHandler(async (req, res) => {
    const result = await prescriptionService.getPrescriptions(req.user.branchId, req.query);
    res.status(200).json(new ApiResponse(200, result, 'Prescriptions fetched successfully'));
});

const getPrescriptionById = asyncHandler(async (req, res) => {
    const rx = await prescriptionService.getPrescriptionById(req.user.branchId, req.params.id);
    res.status(200).json(new ApiResponse(200, rx, 'Prescription details fetched successfully'));
});

const verifyPrescription = asyncHandler(async (req, res) => {
    const { status, rejection_reason, remarks } = req.body;
    const rx = await prescriptionService.verifyPrescription(
        req.user.branchId,
        req.user.userId,
        req.params.id,
        status,
        rejection_reason || remarks
    );
    res.status(200).json(new ApiResponse(200, rx, 'Prescription status updated'));
});

module.exports = {
    upload,
    getPrescriptions,
    getPrescriptionById,
    verifyPrescription,
};
