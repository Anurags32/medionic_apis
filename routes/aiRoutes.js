const express = require('express');
const router = express.Router();

const { checkSymptoms, analyzeReport } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const upload = require('../services/uploadService');


router.use(protect);
router.post('/symptom-checker', checkSymptoms);

router.post('/analyze-report', upload.single('reportFile'), analyzeReport);

module.exports = router;
