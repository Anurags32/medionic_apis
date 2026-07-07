const geminiService = require('../services/geminiService');
const ErrorResponse = require('../utils/errorResponse');

// @desc    AI Symptom Checker
// @route   POST /api/ai/symptom-checker
// @access  Private (any authenticated user)
exports.checkSymptoms = async (req, res, next) => {
    try {
        const { symptoms } = req.body;

        if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
            return next(new ErrorResponse('Please provide a symptoms description', 400));
        }

        if (symptoms.trim().length < 5) {
            return next(new ErrorResponse('Please describe your symptoms in more detail (at least 5 characters)', 400));
        }

        const result = await geminiService.checkSymptoms(symptoms.trim());

        res.status(200).json({
            success: true,
            data: {
                symptoms: symptoms.trim(),
                analysis: result,
                disclaimer: 'This AI analysis is for informational purposes only and does not constitute medical advice. Please consult a qualified healthcare professional for proper diagnosis and treatment.',
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        // Gemini quota / network errors — return a safe fallback
        if (error.message && (error.message.includes('quota') || error.message.includes('429'))) {
            return res.status(429).json({
                success: false,
                message: 'AI service is temporarily unavailable due to rate limits. Please try again in a few minutes.',
                code: 'AI_QUOTA_EXCEEDED'
            });
        }
        next(error);
    }
};

// @desc    AI Medical Report Analyzer
// @route   POST /api/ai/analyze-report
// @access  Private (any authenticated user)
exports.analyzeReport = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new ErrorResponse('Please upload a medical report file (PDF, JPG, or PNG, max 5 MB)', 400));
        }

        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedMimes.includes(req.file.mimetype)) {
            return next(new ErrorResponse('Invalid file type. Only JPEG, PNG, and PDF files are accepted.', 400));
        }

        const result = await geminiService.analyzeReport(req.file);

        res.status(200).json({
            success: true,
            data: {
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                analysis: result,
                disclaimer: 'This AI analysis is for informational purposes only. Always consult a qualified healthcare professional for interpretation of medical results.',
                analyzedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        if (error.message && (error.message.includes('quota') || error.message.includes('429'))) {
            return res.status(429).json({
                success: false,
                message: 'AI service is temporarily unavailable due to rate limits. Please try again in a few minutes.',
                code: 'AI_QUOTA_EXCEEDED'
            });
        }
        next(error);
    }
};
