// Load environment variables from .env file
require('dotenv').config();

// Gemini AI API Configuration
// Get your API key from: https://makersuite.google.com/app/apikey

const GEMINI_CONFIG = {
    // API Key - Set this in your environment variables
    apiKey: process.env.GEMINI_API_KEY || 'your_gemini_api_key_here',
    
    // Model configuration
    model: 'gemini-2.0-flash-exp',
    
    // Generation parameters
    generationConfig: {
        temperature: 0.8,        // Creativity level (0.0 = focused, 1.0 = creative)
        topP: 0.9,              // Nucleus sampling parameter
        topK: 40,               // Top-k sampling parameter
        maxOutputTokens: 150,    // Maximum response length
        stopSequences: ['\n\n', '---', '###'] // Stop generation at these sequences
    },
    
    // Safety settings
    safetySettings: [
        {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
    ],
    
    // Timeout settings
    timeout: 5000,              // 5 seconds timeout for API calls
    
    // Fallback prompts (used when API fails) - Now language-neutral keys
    fallbackPrompts: [
        {
            type: 'engagement',
            priority: 'high',
            message: 'fallback_engagement', // Will be translated by getTranslatedPrompt
            trigger: 'fallback_engagement',
            action: 'ask_direct_question'
        },
        {
            type: 'growth',
            priority: 'medium',
            message: 'fallback_growth', // Will be translated by getTranslatedPrompt
            trigger: 'fallback_growth',
            action: 'encourage_follows_personal'
        },
        {
            type: 'interaction',
            priority: 'medium',
            message: 'fallback_interaction', // Will be translated by getTranslatedPrompt
            trigger: 'fallback_interaction',
            action: 'start_interactive_game'
        },
        {
            type: 'retention',
            priority: 'high',
            message: 'fallback_retention', // Will be translated by getTranslatedPrompt
            trigger: 'fallback_retention',
            action: 'build_connection'
        },
        {
            type: 'momentum',
            priority: 'medium',
            message: 'fallback_momentum', // Will be translated by getTranslatedPrompt
            trigger: 'fallback_momentum',
            action: 'maintain_energy'
        }
    ]
};

module.exports = GEMINI_CONFIG;
