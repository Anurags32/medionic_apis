const express = require('express');
const router = express.Router();
const prescriptionController = require('../../controllers/pharmacy/prescription.controller');
const authenticateToken = require('../../middleware/pharmacy/auth.middleware');
const { authorizeFeature } = require('../../middleware/pharmacy/rbac.middleware');
const { uploadPrescription } = require('../../utils/pharmacyUpload');
const { FEATURES } = require('../../config/pharmacyConstants');

router.use(authenticateToken);

router.post(
    '/upload',
    authorizeFeature(FEATURES.PRESCRIPTIONS_VIEW),
    uploadPrescription.single('prescription'),
    prescriptionController.upload
);

router.get(
    '/',
    authorizeFeature(FEATURES.PRESCRIPTIONS_VIEW),
    prescriptionController.getPrescriptions
);

router.get(
    '/:id',
    authorizeFeature(FEATURES.PRESCRIPTIONS_VIEW),
    prescriptionController.getPrescriptionById
);

router.patch(
    '/:id/verify',
    authorizeFeature(FEATURES.PRESCRIPTIONS_DISPENSE),
    prescriptionController.verifyPrescription
);

module.exports = router;
