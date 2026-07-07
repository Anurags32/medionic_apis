const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const apiKey = process.env.GEMINI_API_KEY || 'dummy_api_key';
const genAI = new GoogleGenerativeAI(apiKey);

// Helper to convert local file to generative part object
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString('base64'),
            mimeType
        }
    };
}

/**
 * AI Symptom Checker
 * @param {string} symptoms 
 * @returns {Promise<string>}
 */
exports.checkSymptoms = async (symptoms) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return "⚠️ [Mock AI Mode] Gemini API key not found. You are experiencing symptoms: " + symptoms + ". Please see a general practitioner.";
        }
        
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            systemInstruction: "You are an AI Health Assistant. Provide a disclaimer that you are not a doctor. Analyze user symptoms and suggest possible medical fields and general recommendations. Keep it concise."
        });

        const result = await model.generateContent(symptoms);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error in checkSymptoms Service:', error.message);
        throw error;
    }
};

/**
 * AI Medical Report Analyzer
 * @param {Object} file - Express Multer file object
 * @returns {Promise<string>}
 */
exports.analyzeReport = async (file) => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return "⚠️ [Mock AI Mode] Gemini API key not found. Report analysis fallback text. All parameters look normal.";
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const generativePart = fileToGenerativePart(file.path, file.mimetype);

        const prompt = "Review this medical report. Extract key parameters, values, and explain any abnormalities in extremely simple, non-medical language.";

        const result = await model.generateContent([prompt, generativePart]);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error in analyzeReport Service:', error.message);
        throw error;
    }
};
