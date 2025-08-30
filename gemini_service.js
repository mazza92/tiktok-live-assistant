const { GoogleGenerativeAI } = require('@google/generative-ai');
const GEMINI_CONFIG = require('./gemini_config');

class GeminiService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: GEMINI_CONFIG.model,
            generationConfig: GEMINI_CONFIG.generationConfig,
            safetySettings: GEMINI_CONFIG.safetySettings
        });
        
        this.isAvailable = GEMINI_CONFIG.apiKey !== 'your_gemini_api_key_here';
        this.lastCallTime = 0;
        this.callCount = 0;
        this.maxCallsPerMinute = 15; // Conservative limit
        
        if (!this.isAvailable) {
            console.warn('⚠️ Gemini API key not configured. Using fallback prompts only.');
        }
    }

    /**
     * Build context string from stream metrics for the LLM
     */
    buildContextString(metrics) {
        const now = new Date();
        const streamDuration = Math.floor((now - metrics.streamStartTime) / 60000); // minutes
        
        // Stream phase analysis
        let streamPhase = 'mid';
        if (streamDuration < 10) streamPhase = 'start';
        else if (streamDuration > 45) streamPhase = 'end';
        
        // Engagement analysis
        const engagementLevel = this.analyzeEngagementLevel(metrics);
        const sentimentStatus = this.analyzeSentimentStatus(metrics);
        const growthStatus = this.analyzeGrowthStatus(metrics);
        
        // Recent events summary
        const recentEvents = this.summarizeRecentEvents(metrics);
        
        // Build the context string
        const context = `
You are LiveBot, an enthusiastic and friendly stream co-host. Your task is to generate a short, actionable prompt for the streamer to say out loud.

STREAM CONTEXT:
- Stream Duration: ${streamDuration} minutes (${streamPhase} phase)
- Current Viewers: ${metrics.currentViewerCount || 0}
- Engagement Level: ${engagementLevel}
- Sentiment: ${sentimentStatus}
- Growth: ${growthStatus}

REAL-TIME METRICS:
- Comments per minute: ${metrics.commentsPerMinute || 0}
- Likes per minute: ${metrics.likesPerMinute || 0}
- Gifts per minute: ${metrics.giftsPerMinute || 0}
- Shares per minute: ${metrics.sharesPerMinute || 0}
- Followers gained this session: ${metrics.sessionFollowersGained || 0}

RECENT ACTIVITY:
${recentEvents}

TASK: Generate a short, energetic prompt (max 2 sentences) that the streamer can say to:
1. Address the current engagement situation
2. Encourage viewer interaction
3. Feel natural and conversational
4. Match the stream's current energy level

FORMAT: Just the prompt text, no explanations or formatting.
        `.trim();

        return context;
    }

    /**
     * Analyze engagement level based on metrics
     */
    analyzeEngagementLevel(metrics) {
        const commentRate = metrics.commentsPerMinute || 0;
        const likeRate = metrics.likesPerMinute || 0;
        const viewerCount = metrics.currentViewerCount || 0;
        
        if (commentRate > 20 && likeRate > 50) return '🔥 EXPLOSIVE - Very high engagement!';
        if (commentRate > 10 && likeRate > 25) return '📈 HIGH - Good engagement';
        if (commentRate > 5 && likeRate > 10) return '✅ MODERATE - Decent engagement';
        if (commentRate > 2 && likeRate > 5) return '📉 LOW - Needs attention';
        return '😴 QUIET - Very low engagement, needs activation';
    }

    /**
     * Analyze sentiment status
     */
    analyzeSentimentStatus(metrics) {
        const sentiment = metrics.rollingSentimentScore || 0;
        if (sentiment > 0.3) return '😊 POSITIVE - Happy audience';
        if (sentiment > -0.1) return '😐 NEUTRAL - Mixed feelings';
        return '😔 NEGATIVE - Audience seems down';
    }

    /**
     * Analyze growth status
     */
    analyzeGrowthStatus(metrics) {
        const followerGains = metrics.sessionFollowersGained || 0;
        const followerRate = metrics.followersGainsPerMinute || 0;
        
        if (followerRate > 3) return '🚀 BOOMING - Gaining followers fast!';
        if (followerGains > 10) return '📈 GROWING - Steady follower growth';
        if (followerGains > 0) return '✅ POSITIVE - Some follower gains';
        return '📊 STABLE - No recent follower changes';
    }

    /**
     * Summarize recent events for context
     */
    summarizeRecentEvents(metrics) {
        const events = [];
        
        // Recent comments
        if (metrics.recentComments && metrics.recentComments.length > 0) {
            const recentComment = metrics.recentComments[0];
            events.push(`- Latest comment from ${recentComment.nickname}: "${recentComment.comment.substring(0, 50)}..."`);
        }
        
        // Recent gifts
        if (metrics.recentGifts && metrics.recentGifts.length > 0) {
            const recentGift = metrics.recentGifts[0];
            events.push(`- Recent gift from ${recentGift.nickname}: ${recentGift.giftName} (${recentGift.giftValue} coins)`);
        }
        
        // New followers
        if (metrics.newFollowers && metrics.newFollowers.length > 0) {
            const newFollower = metrics.newFollowers[0];
            events.push(`- New follower: ${newFollower.nickname}`);
        }
        
        // Pending questions
        if (metrics.questionDetection && metrics.questionDetection.pendingQuestions.length > 0) {
            const questionCount = metrics.questionDetection.pendingQuestions.length;
            events.push(`- ${questionCount} unanswered question(s) waiting`);
        }
        
        if (events.length === 0) {
            events.push('- No recent notable events');
        }
        
        return events.join('\n');
    }

    /**
     * Generate a prompt using Gemini AI
     */
    async generatePrompt(metrics) {
        // Check if API is available and rate limits
        if (!this.isAvailable) {
            console.log('🤖 [GEMINI] API not available, using fallback');
            return this.getFallbackPrompt();
        }
        
        // Rate limiting check
        const now = Date.now();
        if (now - this.lastCallTime < 60000) { // Within 1 minute
            if (this.callCount >= this.maxCallsPerMinute) {
                console.log('🤖 [GEMINI] Rate limit reached, using fallback');
                return this.getFallbackPrompt();
            }
        } else {
            this.callCount = 0;
        }
        
        try {
            // Build context and create timeout promise
            const context = this.buildContextString(metrics);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('API timeout')), GEMINI_CONFIG.timeout);
            });
            
            // Make API call with timeout
            const apiCall = this.model.generateContent(context);
            const result = await Promise.race([apiCall, timeoutPromise]);
            
            // Extract and process response
            const response = await result.response;
            const generatedText = response.text().trim();
            
            // Validate response
            if (!generatedText || generatedText.length > 200) {
                throw new Error('Invalid response from API');
            }
            
            // Update rate limiting
            this.lastCallTime = now;
            this.callCount++;
            
            console.log('🤖 [GEMINI] Successfully generated prompt:', generatedText.substring(0, 50) + '...');
            
            // Return structured prompt object
            return {
                type: 'ai_generated',
                priority: this.determinePriority(metrics),
                message: generatedText,
                trigger: 'ai_analysis',
                action: 'ai_suggestion',
                source: 'gemini',
                context: {
                    engagementLevel: this.analyzeEngagementLevel(metrics),
                    sentiment: this.analyzeSentimentStatus(metrics),
                    streamPhase: this.getStreamPhase(metrics)
                }
            };
            
        } catch (error) {
            console.error('🤖 [GEMINI] Error generating prompt:', error.message);
            return this.getFallbackPrompt();
        }
    }

    /**
     * Determine prompt priority based on metrics
     */
    determinePriority(metrics) {
        const sentiment = metrics.rollingSentimentScore || 0;
        const engagement = metrics.commentsPerMinute || 0;
        const viewers = metrics.currentViewerCount || 0;
        
        // High priority for critical situations
        if (sentiment < -0.3 || engagement < 2 || viewers < 100) {
            return 'high';
        }
        
        // Medium priority for moderate situations
        if (sentiment < 0 || engagement < 5 || viewers < 500) {
            return 'medium';
        }
        
        return 'low';
    }

    /**
     * Get stream phase
     */
    getStreamPhase(metrics) {
        const now = new Date();
        const streamDuration = Math.floor((now - metrics.streamStartTime) / 60000);
        
        if (streamDuration < 10) return 'start';
        if (streamDuration > 45) return 'end';
        return 'mid';
    }

    /**
     * Get a random fallback prompt
     */
    getFallbackPrompt() {
        const randomIndex = Math.floor(Math.random() * GEMINI_CONFIG.fallbackPrompts.length);
        const fallback = GEMINI_CONFIG.fallbackPrompts[randomIndex];
        
        return {
            ...fallback,
            source: 'fallback',
            context: {
                engagementLevel: 'unknown',
                sentiment: 'neutral',
                streamPhase: 'mid'
            }
        };
    }

    /**
     * Check if the service is healthy
     */
    getHealthStatus() {
        return {
            isAvailable: this.isAvailable,
            lastCallTime: this.lastCallTime,
            callCount: this.callCount,
            maxCallsPerMinute: this.maxCallsPerMinute,
            apiKeyConfigured: GEMINI_CONFIG.apiKey !== 'your_gemini_api_key_here'
        };
    }
}

module.exports = GeminiService;
