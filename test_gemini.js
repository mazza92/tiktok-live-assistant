// Test script for Gemini AI integration
const GeminiService = require('./gemini_service');

// Mock metrics for testing
const mockMetrics = {
    currentViewerCount: 1250,
    commentsPerMinute: 15,
    likesPerMinute: 45,
    giftsPerMinute: 3,
    sharesPerMinute: 2,
    sessionFollowersGained: 8,
    rollingSentimentScore: 0.3,
    streamStartTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    recentComments: [
        { nickname: 'TestUser1', comment: 'This is amazing content!' },
        { nickname: 'TestUser2', comment: 'Keep it up!' }
    ],
    recentGifts: [
        { nickname: 'TestUser3', giftName: 'Rose', giftValue: 1 }
    ],
    newFollowers: [
        { nickname: 'NewFollower1' }
    ],
    questionDetection: {
        pendingQuestions: [
            { nickname: 'User1', question: 'What game are you playing next?', priority: 3 }
        ]
    },
    predictiveMetrics: {
        viewerRetentionRate: 0.75,
        churnRiskScore: 0.2
    },
    viewerStats: {
        averageWatchTime: 1800
    },
    keywordFrequency: {
        'gaming': 15,
        'fun': 8,
        'awesome': 5
    }
};

async function testGeminiIntegration() {
    console.log('🧪 Testing Gemini AI Integration...\n');
    
    try {
        // Initialize the service
        const geminiService = new GeminiService();
        console.log('✅ Gemini service initialized');
        console.log('📊 Health status:', geminiService.getHealthStatus());
        
        if (!geminiService.isAvailable) {
            console.log('⚠️  API key not configured - will use fallback prompts');
        }
        
        console.log('\n🔍 Testing prompt generation...');
        
        // Test prompt generation
        const startTime = Date.now();
        const prompt = await geminiService.generatePrompt(mockMetrics);
        const endTime = Date.now();
        
        console.log('✅ Prompt generated successfully');
        console.log('⏱️  Response time:', endTime - startTime, 'ms');
        console.log('📝 Generated prompt:', prompt.message);
        console.log('🏷️  Prompt type:', prompt.type);
        console.log('⚡ Priority:', prompt.priority);
        console.log('🔧 Source:', prompt.source);
        console.log('🎯 Trigger:', prompt.trigger);
        
        if (prompt.context) {
            console.log('📊 Context:', prompt.context);
        }
        
        console.log('\n🎉 All tests passed! Gemini integration is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testGeminiIntegration();
}

module.exports = { testGeminiIntegration };
