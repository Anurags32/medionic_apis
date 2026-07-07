const express = require('express');
const router = express.Router();

const { checkSymptoms, analyzeReport } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');
const upload = require('../services/uploadService');

// All AI routes require authentication
router.use(protect);

// POST /api/ai/symptom-checker — JSON body { symptoms: "..." }
router.post('/symptom-checker', checkSymptoms);

// POST /api/ai/analyze-report — multipart, single file field "reportFile"
router.post('/analyze-report', upload.single('reportFile'), analyzeReport);

module.exports = router;
