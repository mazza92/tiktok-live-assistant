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
    
    // Enhanced fallback prompts with more variety and context awareness
    fallbackPrompts: [
        // Engagement prompts
        {
            type: 'engagement',
            priority: 'high',
            message: 'fallback_engagement_question',
            trigger: 'fallback_engagement_question',
            action: 'ask_direct_question',
            conditions: { commentRate: 'low', viewerCount: 'medium' }
        },
        {
            type: 'engagement',
            priority: 'high',
            message: 'fallback_engagement_poll',
            trigger: 'fallback_engagement_poll',
            action: 'start_poll',
            conditions: { commentRate: 'low', viewerCount: 'high' }
        },
        {
            type: 'engagement',
            priority: 'medium',
            message: 'fallback_engagement_challenge',
            trigger: 'fallback_engagement_challenge',
            action: 'start_challenge',
            conditions: { commentRate: 'medium', viewerCount: 'medium' }
        },
        
        // Growth prompts
        {
            type: 'growth',
            priority: 'medium',
            message: 'fallback_growth_welcome',
            trigger: 'fallback_growth_welcome',
            action: 'welcome_new_viewers',
            conditions: { viewerCount: 'growing', streamPhase: 'start' }
        },
        {
            type: 'growth',
            priority: 'medium',
            message: 'fallback_growth_community',
            trigger: 'fallback_growth_community',
            action: 'build_community',
            conditions: { viewerCount: 'stable', engagement: 'high' }
        },
        {
            type: 'growth',
            priority: 'low',
            message: 'fallback_growth_share',
            trigger: 'fallback_growth_share',
            action: 'encourage_sharing',
            conditions: { viewerCount: 'high', engagement: 'high' }
        },
        
        // Interaction prompts
        {
            type: 'interaction',
            priority: 'medium',
            message: 'fallback_interaction_game',
            trigger: 'fallback_interaction_game',
            action: 'start_interactive_game',
            conditions: { commentRate: 'medium', viewerCount: 'medium' }
        },
        {
            type: 'interaction',
            priority: 'medium',
            message: 'fallback_interaction_story',
            trigger: 'fallback_interaction_story',
            action: 'share_story',
            conditions: { commentRate: 'low', viewerCount: 'low' }
        },
        {
            type: 'interaction',
            priority: 'high',
            message: 'fallback_interaction_react',
            trigger: 'fallback_interaction_react',
            action: 'react_to_content',
            conditions: { commentRate: 'high', engagement: 'high' }
        },
        
        // Retention prompts
        {
            type: 'retention',
            priority: 'high',
            message: 'fallback_retention_connection',
            trigger: 'fallback_retention_connection',
            action: 'build_connection',
            conditions: { viewerCount: 'declining', engagement: 'low' }
        },
        {
            type: 'retention',
            priority: 'medium',
            message: 'fallback_retention_value',
            trigger: 'fallback_retention_value',
            action: 'provide_value',
            conditions: { viewerCount: 'stable', engagement: 'medium' }
        },
        {
            type: 'retention',
            priority: 'high',
            message: 'fallback_retention_energy',
            trigger: 'fallback_retention_energy',
            action: 'boost_energy',
            conditions: { engagement: 'very_low', viewerCount: 'medium' }
        },
        
        // Momentum prompts
        {
            type: 'momentum',
            priority: 'medium',
            message: 'fallback_momentum_maintain',
            trigger: 'fallback_momentum_maintain',
            action: 'maintain_energy',
            conditions: { engagement: 'high', viewerCount: 'high' }
        },
        {
            type: 'momentum',
            priority: 'medium',
            message: 'fallback_momentum_celebrate',
            trigger: 'fallback_momentum_celebrate',
            action: 'celebrate_achievements',
            conditions: { gifts: 'high', engagement: 'high' }
        },
        {
            type: 'momentum',
            priority: 'low',
            message: 'fallback_momentum_next',
            trigger: 'fallback_momentum_next',
            action: 'tease_next_content',
            conditions: { streamPhase: 'end', engagement: 'medium' }
        }
    ]
};

module.exports = GEMINI_CONFIG;
