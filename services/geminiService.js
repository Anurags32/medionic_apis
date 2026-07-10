const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const apiKey = process.env.GEMINI_API_KEY || 'dummy_api_key';
const isOpenRouter = apiKey.startsWith('sk-or-');
const genAI = !isOpenRouter ? new GoogleGenerativeAI(apiKey) : null;

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
        
        if (isOpenRouter) {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/Anurags32/medionic_apis',
                    'X-Title': 'Medionic Healthcare APIs'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages: [
                        {
                            role: 'system',
                            content: "You are an AI Health Assistant. Provide a disclaimer that you are not a doctor. Analyze user symptoms and suggest possible medical fields and general recommendations. Keep it concise."
                        },
                        {
                            role: 'user',
                            content: symptoms
                        }
                    ],
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
            }

            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            }
            throw new Error(`Unexpected OpenRouter response format: ${JSON.stringify(data)}`);
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

        if (isOpenRouter) {
            const fileData = Buffer.from(fs.readFileSync(file.path)).toString('base64');
            const dataUrl = `data:${file.mimetype};base64,${fileData}`;

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/Anurags32/medionic_apis',
                    'X-Title': 'Medionic Healthcare APIs'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: "Review this medical report. Extract key parameters, values, and explain any abnormalities in extremely simple, non-medical language."
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: dataUrl
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
            }

            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            }
            throw new Error(`Unexpected OpenRouter response format: ${JSON.stringify(data)}`);
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
