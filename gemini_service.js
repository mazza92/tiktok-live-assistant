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
    buildContextString(metrics, language = 'en') {
        const now = new Date();
        const streamDuration = Math.floor((now - metrics.streamStartTime) / 60000); // minutes
        
        // Enhanced stream phase analysis
        let streamPhase = 'mid';
        let phaseContext = '';
        if (streamDuration < 10) {
            streamPhase = 'start';
            phaseContext = 'Stream just started - focus on welcoming new viewers and setting the tone';
        } else if (streamDuration > 45) {
            streamPhase = 'end';
            phaseContext = 'Stream is ending soon - focus on thanking viewers and encouraging follows';
        } else {
            phaseContext = 'Mid-stream - maintain engagement and build community';
        }
        
        // Enhanced engagement analysis
        const engagementLevel = this.analyzeEngagementLevel(metrics);
        const sentimentStatus = this.analyzeSentimentStatus(metrics);
        const growthStatus = this.analyzeGrowthStatus(metrics);
        const energyLevel = this.analyzeEnergyLevel(metrics);
        const viewerTrend = this.analyzeViewerTrend(metrics);
        
        // Recent events summary with more detail
        const recentEvents = this.summarizeRecentEvents(metrics);
        const topEngagedUsers = this.getTopEngagedUsers(metrics);
        const contentSuggestions = this.getContentSuggestions(metrics);
        
        // Language-specific instructions
        const languageInstructions = language === 'fr' ? 
            'IMPORTANT: Generate your response in French. Use natural, conversational French that a French streamer would say.' :
            'IMPORTANT: Generate your response in English. Use natural, conversational English that an English streamer would say.';
        
        // Build the enhanced context string
        const context = `
You are LiveBot, an expert stream co-host with deep knowledge of streaming psychology and audience engagement. Your task is to generate a specific, actionable prompt that will genuinely help the streamer improve their stream.

${languageInstructions}

STREAM CONTEXT:
- Stream Duration: ${streamDuration} minutes (${streamPhase} phase)
- Phase Context: ${phaseContext}
- Current Viewers: ${metrics.currentViewerCount || 0}
- Viewer Trend: ${viewerTrend}
- Engagement Level: ${engagementLevel}
- Energy Level: ${energyLevel}
- Sentiment: ${sentimentStatus}
- Growth: ${growthStatus}

DETAILED METRICS:
- Comments per minute: ${metrics.commentsPerMinute || 0}
- Likes per minute: ${metrics.likesPerMinute || 0}
- Gifts per minute: ${metrics.giftsPerMinute || 0}
- Shares per minute: ${metrics.sharesPerMinute || 0}
- Followers gained this session: ${metrics.sessionFollowersGained || 0}
- Average watch time: ${metrics.averageWatchTime || 0} seconds
- Viewer retention: ${metrics.viewerRetention || 0}%

RECENT ACTIVITY:
${recentEvents}

TOP ENGAGED USERS:
${topEngagedUsers}

CONTENT SUGGESTIONS:
${contentSuggestions}

TASK: Generate a specific, actionable prompt (1-2 sentences) that:
1. Addresses the current stream situation with precision
2. Provides a clear, specific action for the streamer
3. Feels natural and matches the stream's energy
4. Helps build genuine community connection
5. Avoids generic phrases like "hit that follow button"

EXAMPLES OF GOOD PROMPTS:
- "I see we have some new faces! Drop a comment and tell me what brought you here today"
- "The chat is buzzing! Let's do a quick poll - what's your favorite part of this stream so far?"
- "I love the energy right now! Who wants to share their biggest win this week?"

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
    async generatePrompt(metrics, language = 'en') {
        // Check if API is available and rate limits
        if (!this.isAvailable) {
            console.log('🤖 [GEMINI] API not available, using fallback');
            return this.getFallbackPrompt(metrics, language);
        }
        
        // Rate limiting check
        const now = Date.now();
        if (now - this.lastCallTime < 60000) { // Within 1 minute
            if (this.callCount >= this.maxCallsPerMinute) {
                console.log('🤖 [GEMINI] Rate limit reached, using fallback');
                return this.getFallbackPrompt(metrics, language);
            }
        } else {
            this.callCount = 0;
        }
        
        try {
            // Build context and create timeout promise
            const context = this.buildContextString(metrics, language);
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
            return this.getFallbackPrompt(metrics);
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
     * Analyze energy level based on activity patterns
     */
    analyzeEnergyLevel(metrics) {
        const commentRate = metrics.commentsPerMinute || 0;
        const likeRate = metrics.likesPerMinute || 0;
        const giftRate = metrics.giftsPerMinute || 0;
        const viewerCount = metrics.currentViewerCount || 0;
        
        const totalActivity = commentRate + (likeRate / 10) + (giftRate * 5);
        const activityPerViewer = viewerCount > 0 ? totalActivity / viewerCount : 0;
        
        if (activityPerViewer > 2) return '🔥 HIGH - Very active chat and engagement';
        if (activityPerViewer > 1) return '⚡ MEDIUM - Good energy, room to grow';
        if (activityPerViewer > 0.5) return '💤 LOW - Chat is quiet, needs activation';
        return '😴 VERY LOW - Minimal engagement, needs immediate attention';
    }

    /**
     * Analyze viewer trend (growing, stable, declining)
     */
    analyzeViewerTrend(metrics) {
        const currentViewers = metrics.currentViewerCount || 0;
        const peakViewers = metrics.peakViewerCount || 0;
        const avgViewers = metrics.averageViewerCount || 0;
        
        if (currentViewers > peakViewers * 0.9) return '📈 GROWING - Near peak viewers';
        if (currentViewers > avgViewers * 1.1) return '📊 STABLE - Above average';
        if (currentViewers < avgViewers * 0.8) return '📉 DECLINING - Below average';
        return '📊 STABLE - Normal fluctuation';
    }

    /**
     * Get top engaged users summary
     */
    getTopEngagedUsers(metrics) {
        if (!metrics.topEngagedUsers || metrics.topEngagedUsers.length === 0) {
            return 'No specific user data available';
        }
        
        const topUsers = metrics.topEngagedUsers.slice(0, 3);
        return topUsers.map(user => 
            `${user.nickname}: ${user.likes} likes, ${user.gifts} gifts, ${user.comments} comments`
        ).join('\n');
    }

    /**
     * Get content suggestions based on current metrics
     */
    getContentSuggestions(metrics) {
        const commentRate = metrics.commentsPerMinute || 0;
        const viewerCount = metrics.currentViewerCount || 0;
        const streamDuration = Math.floor((Date.now() - metrics.streamStartTime) / 60000);
        
        const suggestions = [];
        
        if (commentRate < 3 && viewerCount > 10) {
            suggestions.push('Ask direct questions to activate chat');
        }
        if (viewerCount > 50 && commentRate > 5) {
            suggestions.push('Perfect time for interactive content or polls');
        }
        if (streamDuration > 30 && commentRate > 8) {
            suggestions.push('High engagement - consider extending stream or doing special content');
        }
        if (metrics.totalGifts > 10) {
            suggestions.push('Gift activity is high - acknowledge supporters and encourage more');
        }
        if (metrics.sessionFollowersGained > 5) {
            suggestions.push('Good growth - welcome new followers and build community');
        }
        
        return suggestions.length > 0 ? suggestions.join('\n') : 'Continue current content strategy';
    }

    /**
     * Get a context-aware fallback prompt
     */
    getFallbackPrompt(metrics = {}, language = 'en') {
        // If we have metrics, generate a context-aware fallback
        if (metrics && Object.keys(metrics).length > 0) {
            return this.generateContextAwareFallback(metrics, language);
        }
        
        // Otherwise, use random selection
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
     * Generate a context-aware fallback prompt based on current metrics
     */
    generateContextAwareFallback(metrics, language = 'en') {
        const viewerCount = metrics.currentViewerCount || 0;
        const commentRate = metrics.commentsPerMinute || 0;
        const likeRate = metrics.likesPerMinute || 0;
        const giftRate = metrics.giftsPerMinute || 0;
        const sentiment = metrics.rollingSentimentScore || 0;
        const streamDuration = Math.floor((Date.now() - metrics.streamStartTime) / 60000);
        
        // Get recent prompt history to avoid repetition
        const recentPrompts = metrics.promptHistory || [];
        const lastPrompt = recentPrompts[recentPrompts.length - 1];
        
        // Enhanced selection logic with more variety
        let candidatePrompts = [];
        
        // Engagement-based selection
        if (commentRate < 2 && viewerCount > 5) {
            // Very low engagement - need immediate activation
            candidatePrompts = GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'engagement' && p.priority === 'high'
            );
        } else if (commentRate < 5 && viewerCount > 10) {
            // Low engagement - variety of engagement prompts
            candidatePrompts = GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'engagement'
            );
        } else if (viewerCount > 50 && commentRate > 5) {
            // Good engagement - focus on growth and community
            candidatePrompts = GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'growth' || p.type === 'interaction'
            );
        } else if (commentRate > 10 && likeRate > 20) {
            // High engagement - maintain momentum
            candidatePrompts = GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'momentum' || p.type === 'interaction'
            );
        } else if (viewerCount < 20) {
            // Small audience - focus on retention and connection
            candidatePrompts = GEMINI_CONFIG.fallbackPrompts.filter(p => 
                p.type === 'retention'
            );
        } else {
            // Default - mix of all types
            candidatePrompts = GEMINI_CONFIG.fallbackPrompts;
        }
        
        // Stream phase adjustments
        if (streamDuration < 10) {
            // Early stream - prioritize welcome and engagement
            candidatePrompts = candidatePrompts.filter(p => 
                p.action === 'welcome_new_viewers' || p.type === 'engagement'
            );
        } else if (streamDuration > 45) {
            // Late stream - focus on retention and next content
            candidatePrompts = candidatePrompts.filter(p => 
                p.action === 'tease_next_content' || p.type === 'retention'
            );
        }
        
        // Avoid repeating the last prompt type
        if (lastPrompt && candidatePrompts.length > 1) {
            candidatePrompts = candidatePrompts.filter(p => p.trigger !== lastPrompt);
        }
        
        // If no candidates, use all prompts
        if (candidatePrompts.length === 0) {
            candidatePrompts = GEMINI_CONFIG.fallbackPrompts;
        }
        
        // Select random prompt from candidates
        const randomIndex = Math.floor(Math.random() * candidatePrompts.length);
        const selectedPrompt = candidatePrompts[randomIndex];
        
        // Return the prompt with enhanced context
        return {
            ...selectedPrompt,
            message: selectedPrompt.message,
            source: 'context_aware_fallback',
            context: {
                engagementLevel: this.analyzeEngagementLevel(metrics),
                sentiment: this.analyzeSentimentStatus(metrics),
                streamPhase: this.getStreamPhase(metrics),
                energyLevel: this.analyzeEnergyLevel(metrics),
                viewerTrend: this.analyzeViewerTrend(metrics),
                viewerCount: viewerCount,
                commentRate: commentRate,
                likeRate: likeRate,
                giftRate: giftRate,
                streamDuration: streamDuration
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
