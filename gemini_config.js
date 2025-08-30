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
    
    // Fallback prompts (used when API fails)
    fallbackPrompts: [
        {
            type: 'engagement',
            priority: 'high',
            message: '💬 **Chat Engagement**: The chat is quiet right now. Ask viewers directly: "What\'s on your mind today?" or "Share something that made you laugh this week!"',
            trigger: 'fallback_engagement',
            action: 'ask_direct_question'
        },
        {
            type: 'growth',
            priority: 'medium',
            message: '📈 **Viewer Connection**: Great energy! Personalize your ask: "If you\'re enjoying this, hit that follow button and let\'s build this community together!"',
            trigger: 'fallback_growth',
            action: 'encourage_follows_personal'
        },
        {
            type: 'interaction',
            priority: 'medium',
            message: '🎯 **Interactive Challenge**: Start a quick game! "Comment with your favorite emoji if you\'ve ever been to [relevant place/topic]!" or "Type YES if you agree with this!"',
            trigger: 'fallback_interaction',
            action: 'start_interactive_game'
        },
        {
            type: 'retention',
            priority: 'high',
            message: '👥 **Viewer Retention**: Connect with your audience! "I want to hear from you - what brought you to this stream today?" or "Share your experience with [current topic]!"',
            trigger: 'fallback_retention',
            action: 'build_connection'
        },
        {
            type: 'momentum',
            priority: 'medium',
            message: '🚀 **Keep Momentum**: The energy is building! "Let\'s keep this going - what\'s your take on [current topic]?" or "I love hearing your thoughts, keep them coming!"',
            trigger: 'fallback_momentum',
            action: 'maintain_energy'
        }
    ]
};

module.exports = GEMINI_CONFIG;
