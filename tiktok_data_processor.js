const { WebcastPushConnection } = require('tiktok-live-connector');
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const Sentiment = require('sentiment');
const GeminiService = require('./gemini_service');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure Express middleware
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Initialize Gemini AI service
const geminiService = new GeminiService();
console.log('🤖 [GEMINI] Service initialized:', geminiService.getHealthStatus());

// Global language setting for AI prompts (default: English)
let currentLanguage = 'en';

// AI Prompt Translations
const promptTranslations = {
    en: {
        // Chat Activation prompts
        chatActivation: "💬 **Chat Activation**: With {viewerCount} viewers, chat is quiet ({commentRate} comments/min). Say: \"I want to hear from you! What's on your mind today?\" or \"Comment with your favorite emoji if you're enjoying this stream!\"",
        likeBoost: "❤️ **Like Boost**: Current like rate is {likeRate}/min with {viewerCount} viewers. Say: \"If you're enjoying this, hit that like button! It really helps the stream!\" or \"Show some love with a like if you agree with this!\"",
        communityGrowth: "📈 **Community Growth**: Great energy with {viewerCount} viewers! Say: \"If you're new here, hit that follow button and let's build this community together!\" or \"I love seeing new faces! Drop a comment and let me know where you're from!\"",
        aiEngagementBoost: "💬 **AI Engagement Boost**: Engagement is low with {viewerCount} viewers. Say: \"I want to hear your thoughts! What's your take on this?\" or \"Let's get this chat moving! Share something that made you laugh today!\"",
        aiInteraction: "🎯 **AI Interaction**: Moderate engagement detected. Say: \"I love hearing from you! What's your experience with this?\" or \"Keep the conversation going! What do you think about this topic?\"",
        aiMomentum: "🎯 **AI Momentum**: Good engagement! Say: \"The energy is amazing! Let's keep it going - what's your opinion on this?\" or \"I love this energy! Share something that excites you about this topic!\"",
        // Fallback prompts
        fallback_engagement: "💬 **Chat Engagement**: The chat is quiet right now. Ask viewers directly: \"What's on your mind today?\" or \"Share something that made you laugh this week!\"",
        fallback_growth: "📈 **Viewer Connection**: Great energy! Personalize your ask: \"If you're enjoying this, hit that follow button and let's build this community together!\"",
        fallback_interaction: "🎯 **Interactive Challenge**: Start a quick game! \"Comment with your favorite emoji if you've ever been to [relevant place/topic]!\" or \"Type YES if you agree with this!\"",
        fallback_retention: "👥 **Viewer Retention**: Connect with your audience! \"I want to hear from you - what brought you to this stream today?\" or \"Share your experience with [current topic]!\"",
        fallback_momentum: "🚀 **Keep Momentum**: The energy is building! \"Let's keep this going - what's your take on [current topic]?\" or \"I love hearing your thoughts, keep them coming!\""
    },
    fr: {
        // Chat Activation prompts
        chatActivation: "💬 **Activation du Chat**: Avec {viewerCount} spectateurs, le chat est calme ({commentRate} commentaires/min). Dites: \"Je veux entendre votre avis ! Qu'est-ce qui vous préoccupe aujourd'hui ?\" ou \"Commentez avec votre emoji préféré si vous aimez ce stream !\"",
        likeBoost: "❤️ **Boost des Likes**: Le taux de likes actuel est de {likeRate}/min avec {viewerCount} spectateurs. Dites: \"Si vous aimez ça, appuyez sur le bouton like ! Ça aide vraiment le stream !\" ou \"Montrez votre amour avec un like si vous êtes d'accord !\"",
        communityGrowth: "📈 **Croissance de la Communauté**: Excellente énergie avec {viewerCount} spectateurs ! Dites: \"Si vous êtes nouveau ici, appuyez sur le bouton follow et construisons cette communauté ensemble !\" ou \"J'adore voir de nouveaux visages ! Laissez un commentaire et dites-moi d'où vous venez !\"",
        aiEngagementBoost: "💬 **Boost d'Engagement IA**: L'engagement est faible avec {viewerCount} spectateurs. Dites: \"Je veux entendre vos pensées ! Qu'est-ce que vous en pensez ?\" ou \"Faisons bouger ce chat ! Partagez quelque chose qui vous a fait rire aujourd'hui !\"",
        aiInteraction: "🎯 **Interaction IA**: Engagement modéré détecté. Dites: \"J'adore vous entendre ! Quelle est votre expérience avec ça ?\" ou \"Continuez la conversation ! Que pensez-vous de ce sujet ?\"",
        aiMomentum: "🎯 **Élan IA**: Bon engagement ! Dites: \"L'énergie est incroyable ! Continuons - quelle est votre opinion sur ça ?\" ou \"J'adore cette énergie ! Partagez quelque chose qui vous excite sur ce sujet !\"",
        // Fallback prompts
        fallback_engagement: "💬 **Engagement du Chat**: Le chat est calme en ce moment. Demandez directement aux spectateurs: \"Qu'est-ce qui vous préoccupe aujourd'hui ?\" ou \"Partagez quelque chose qui vous a fait rire cette semaine !\"",
        fallback_growth: "📈 **Connexion avec les Spectateurs**: Excellente énergie ! Personnalisez votre demande: \"Si vous aimez ça, appuyez sur le bouton follow et construisons cette communauté ensemble !\"",
        fallback_interaction: "🎯 **Défi Interactif**: Commencez un jeu rapide ! \"Commentez avec votre emoji préféré si vous êtes déjà allé à [lieu/sujet pertinent] !\" ou \"Tapez OUI si vous êtes d'accord avec ça !\"",
        fallback_retention: "👥 **Rétention des Spectateurs**: Connectez-vous avec votre audience ! \"Je veux vous entendre - qu'est-ce qui vous a amené à ce stream aujourd'hui ?\" ou \"Partagez votre expérience avec [sujet actuel] !\"",
        fallback_momentum: "🚀 **Maintenir l'Élan**: L'énergie se construit ! \"Continuons - qu'est-ce que vous pensez de [sujet actuel] ?\" ou \"J'adore entendre vos pensées, continuez !\""
    }
};

// Gift value mapping (TikTok diamonds to USD conversion)
// Based on TikTok's coin pricing: 70 coins = $0.89, so 1 coin ≈ $0.0127
// TikTok diamonds are the same as TikTok coins
// Source: https://www.dexerto.com/tiktok/what-are-tiktok-gifts-and-how-much-do-they-cost-2216794/
const GIFT_VALUES = {
    // Popular gifts with their diamond/coin costs and accurate USD values
    'Rose': { diamonds: 1, usd: 0.0127 },
    'Heart': { diamonds: 1, usd: 0.0127 },
    'Dalgona Candy': { diamonds: 1, usd: 0.0127 },
    'Brat': { diamonds: 1, usd: 0.0127 },
    'Ice Cube': { diamonds: 1, usd: 0.0127 },
    '2025': { diamonds: 1, usd: 0.0127 },
    'Heart Me': { diamonds: 1, usd: 0.0127 },
    'Kiss': { diamonds: 5, usd: 0.0635 },
    'Cake': { diamonds: 10, usd: 0.127 },
    'Crown': { diamonds: 50, usd: 0.635 },
    'Diamond': { diamonds: 100, usd: 1.27 },
    'Rocket': { diamonds: 500, usd: 6.35 },
    'Lion': { diamonds: 1000, usd: 12.70 },
    'Dragon': { diamonds: 2000, usd: 25.40 },
    'Unicorn': { diamonds: 5000, usd: 63.50 },
    'Galaxy': { diamonds: 10000, usd: 127.00 },
    'Universe': { diamonds: 50000, usd: 635.00 },
    'Castle': { diamonds: 10000, usd: 127.00 }, // Popular high-value gift
    'Leopard': { diamonds: 5000, usd: 63.50 }  // Popular mid-value gift
};

// Data processing and metrics storage with memory optimization
let metrics = {
    currentViewerCount: 0,
    
    // Cumulative totals (all-time, never reset)
    totalLikes: 0,
    totalGifts: 0,
    totalGiftDiamonds: 0, // Total diamonds received
    totalGiftValue: 0, // Total USD value of gifts
    totalComments: 0,
    totalShares: 0,
    sessionFollowersGained: 0, // Total followers gained in current live session
    
    likesPerMinute: 0,
    giftsPerMinute: 0,
    giftsPerMinuteDiamonds: 0, // Diamonds per minute
    giftsPerMinuteValue: 0, // USD value per minute
    commentsPerMinute: 0,
    followersGainsPerMinute: 0, // Track new followers gained per minute
    recentComments: [],
    recentLikes: [],
    recentGifts: [],
    recentGiftValues: [], // Track gift values over time
    recentShares: [],
    userLikeCounts: {}, // Track likes per user
    newFollowers: [], // Track new followers
    sentimentScore: 0, // Automated sentiment score
    rollingSentimentScore: 0, // Rolling average of last 100 comments
    commentSentiments: [], // Store sentiment scores for rolling average (max 100)
    keywordFrequency: {}, // Track keyword mentions (max 50 keywords)
    lastPromptTime: 0, // Track when last prompt was sent
    promptCooldowns: {}, // Track cooldowns for different prompt types
    viewerHistory: [], // Track viewer count over time (max 100 entries)
    
    // Viewer watch time tracking
    viewers: {}, // Track individual viewers and their watch time
    viewerStats: {
        totalUniqueViewers: 0,
        averageWatchTime: 0,
        longestWatchTime: 0,
        viewersByWatchTime: {
            '0-5min': 0,
            '5-15min': 0,
            '15-30min': 0,
            '30min+': 0
        }
    },
    
    lastUpdate: new Date(),
    
    // Entertainment Level Metrics (NEW!)
    entertainmentMetrics: {
        entertainmentScore: 0, // 0-100, overall entertainment level
        engagementIntensity: 0, // How actively engaged the audience is
        contentReception: 0, // How well content is being received
        audienceEnergy: 0, // High energy = highly entertained
        retentionQuality: 0, // Quality of viewer retention
        lastEntertainmentUpdate: new Date()
    },
    
    // Question Detection & Viewer Interaction (NEW!)
    questionDetection: {
        pendingQuestions: [], // Questions waiting for streamer response
        answeredQuestions: [], // Questions that have been addressed
        questionStats: {
            totalQuestions: 0,
            answeredQuestions: 0,
            responseRate: 0,
            averageResponseTime: 0
        },
        lastQuestionUpdate: new Date()
    },
    
    // Predictive Analytics Data
    predictiveMetrics: {
        churnRiskScore: 0, // 0-100, higher = higher risk
        monetizationOpportunityScore: 0, // 0-100, higher = better opportunity
        engagementTrend: 'stable', // 'increasing', 'stable', 'declining', 'critical'
        viewerRetentionRate: 0, // Percentage of viewers retained over time
        peakEngagementMoments: [], // Track when engagement was highest
        lowEngagementPeriods: [], // Track when engagement was lowest
        giftCorrelationData: [], // Correlate gifts with content/context
        sentimentVolatility: 0, // How much sentiment fluctuates
        userEngagementPatterns: {}, // Individual user engagement patterns
        contentPerformanceHistory: [] // Track what content performs best
    },

    // New: Stream phase tracking for context-aware prompts
    streamStartTime: new Date(),
    streamPhase: 'start', // 'start', 'mid', 'end' – updated periodically
    // New: Prompt history to avoid repetition and rotate suggestions
    promptHistory: [], // Array of recent prompt triggers
    
    // Deduplication tracking for followers to prevent duplicates
    processedFollowers: new Set() // Track processed follower IDs to prevent duplicates
};

// Time-based tracking for per-minute calculations
let likesInLastMinute = [];
let giftsInLastMinute = [];
let commentsInLastMinute = [];
let sharesInLastMinute = [];
let followersGainedInLastMinute = []; // Track when followers were gained

// Reset session-specific metrics for new stream
function resetSessionMetrics() {
    console.log('🔄 [METRICS] Resetting session metrics for new stream...');
    metrics.sessionFollowersGained = 0;
    metrics.newFollowers = [];
    followersGainedInLastMinute = [];
    
    // Reset processed followers tracking to prevent duplicates in new sessions
    if (metrics.processedFollowers) {
        metrics.processedFollowers.clear();
        console.log('🧹 [METRICS] Cleared processed followers tracking for new session');
    }
    
    // Clean up any existing duplicates
    if (typeof cleanupDuplicateFollowers === 'function') {
        cleanupDuplicateFollowers();
    }
    
    // Reset new metrics
    metrics.streamStartTime = new Date();
    metrics.streamPhase = 'start';
    metrics.promptHistory = [];
    
    console.log('✅ [METRICS] Session metrics reset complete');
}

// Comment cleaning function for sentiment analysis
function cleanComment(commentText) {
    if (!commentText) return '';
    
    // Remove emojis and symbols
    let cleaned = commentText.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    
    // Remove @username mentions
    cleaned = cleaned.replace(/@\w+/g, '');
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Filter out trivial comments
    if (cleaned.length < 3 || /^(hi|hello|hey|lol|omg|wow|nice|cool|ok|yes|no)$/i.test(cleaned)) {
        return null; // Filter out trivial comments
    }
    
    return cleaned;
}

// Extract initial room state from TikTok connection
function extractInitialRoomState(state) {
    console.log('🔍 [ROOM STATE] Extracting initial room state from TikTok...');
    
    try {
        // Log the full state object to see what's available
        console.log('📊 [ROOM STATE] Full room state:', JSON.stringify(state, null, 2));
        
        // Try to extract existing totals from various possible locations
        let initialLikes = 0;
        let initialGifts = 0;
        let initialComments = 0;
        let initialViewers = 0;
        
        // More aggressive search for likes in different possible locations
        if (state.likes && typeof state.likes === 'number') {
            initialLikes = state.likes;
        } else if (state.totalLikes && typeof state.totalLikes === 'number') {
            initialLikes = state.totalLikes;
        } else if (state.likeCount && typeof state.likeCount === 'number') {
            initialLikes = state.likeCount;
        } else if (state.roomStats && state.roomStats.likes) {
            initialLikes = state.roomStats.likes;
        } else if (state.stats && state.stats.likes) {
            initialLikes = state.stats.likes;
        } else if (state.room && state.room.likes) {
            initialLikes = state.room.likes;
        } else if (state.live && state.live.likes) {
            initialLikes = state.live.likes;
        }
        
        // More aggressive search for gifts
        if (state.gifts && typeof state.gifts === 'number') {
            initialGifts = state.gifts;
        } else if (state.totalGifts && typeof state.totalGifts === 'number') {
            initialGifts = state.totalGifts;
        } else if (state.giftCount && typeof state.giftCount === 'number') {
            initialGifts = state.giftCount;
        } else if (state.roomStats && state.roomStats.gifts) {
            initialGifts = state.roomStats.gifts;
        } else if (state.stats && state.stats.gifts) {
            initialGifts = state.stats.gifts;
        } else if (state.room && state.room.gifts) {
            initialGifts = state.room.gifts;
        } else if (state.live && state.live.gifts) {
            initialGifts = state.live.gifts;
        }
        
        // More aggressive search for comments
        if (state.comments && typeof state.comments === 'number') {
            initialComments = state.comments;
        } else if (state.totalComments && typeof state.totalComments === 'number') {
            initialComments = state.totalComments;
        } else if (state.commentCount && typeof state.commentCount === 'number') {
            initialComments = state.commentCount;
        } else if (state.roomStats && state.roomStats.comments) {
            initialComments = state.roomStats.comments;
        } else if (state.stats && state.stats.comments) {
            initialComments = state.stats.comments;
        } else if (state.room && state.room.comments) {
            initialComments = state.room.comments;
        } else if (state.live && state.live.comments) {
            initialComments = state.live.comments;
        }
        
        // More aggressive search for viewer count
        if (state.viewerCount && typeof state.viewerCount === 'number') {
            initialViewers = state.viewerCount;
        } else if (state.viewers && typeof state.viewers === 'number') {
            initialViewers = state.viewers;
        } else if (state.stats && state.stats.viewerCount) {
            initialViewers = state.stats.viewerCount;
        } else if (state.room && state.room.viewerCount) {
            initialViewers = state.room.viewerCount;
        } else if (state.live && state.live.viewerCount) {
            initialViewers = state.live.viewerCount;
        }
        
        // Deep search through nested objects
        if (initialLikes === 0) {
            const deepLikes = findDeepValue(state, ['likes', 'totalLikes', 'likeCount', 'total']);
            if (deepLikes && typeof deepLikes === 'number') {
                initialLikes = deepLikes;
            }
        }
        
        if (initialGifts === 0) {
            const deepGifts = findDeepValue(state, ['gifts', 'totalGifts', 'giftCount', 'total']);
            if (deepGifts && typeof deepGifts === 'number') {
                initialGifts = deepGifts;
            }
        }
        
        if (initialComments === 0) {
            const deepComments = findDeepValue(state, ['comments', 'totalComments', 'commentCount', 'total']);
            if (deepComments && typeof deepComments === 'number') {
                initialComments = deepComments;
            }
        }
        
        // Set the initial values as our starting point
        if (initialLikes > 0) {
            metrics.totalLikes = initialLikes;
            console.log(`🎯 [ROOM STATE] Initial total likes: ${initialLikes.toLocaleString()}`);
        }
        
        if (initialGifts > 0) {
            metrics.totalGifts = initialGifts;
            console.log(`🎯 [ROOM STATE] Initial total gifts: ${initialGifts.toLocaleString()}`);
        }
        
        if (initialComments > 0) {
            metrics.totalComments = initialComments;
            console.log(`🎯 [ROOM STATE] Initial total comments: ${initialComments.toLocaleString()}`);
        }
        
        if (initialViewers > 0) {
            metrics.currentViewerCount = initialViewers;
            console.log(`🎯 [ROOM STATE] Initial viewer count: ${initialViewers.toLocaleString()}`);
        }
        
        // Log all available keys in the state object for debugging
        console.log('🔍 [ROOM STATE] Available keys:', Object.keys(state));
        if (state.roomStats) {
            console.log('🔍 [ROOM STATE] Room stats keys:', Object.keys(state.roomStats));
        }
        if (state.stats) {
            console.log('🔍 [ROOM STATE] Stats keys:', Object.keys(state.stats));
        }
        if (state.room) {
            console.log('🔍 [ROOM STATE] Room keys:', Object.keys(state.room));
        }
        if (state.live) {
            console.log('🔍 [ROOM STATE] Live keys:', Object.keys(state.room));
        }
        
        console.log('✅ [ROOM STATE] Initial room state extraction complete');
        
        // Broadcast updated metrics to dashboard if we found any data (only if no sessions active)
        if (userSessions.size === 0 && (initialLikes > 0 || initialGifts > 0 || initialComments > 0 || initialViewers > 0)) {
            broadcastMetrics();
        }
        
    } catch (error) {
        console.error('❌ [ROOM STATE] Error extracting initial room state:', error);
    }
}

// Helper function to search deep in nested objects
function findDeepValue(obj, keys) {
    for (const key of keys) {
        if (obj && obj[key] !== undefined) {
            return obj[key];
        }
    }
    
    // Search recursively through all object values
    if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
            if (v && typeof v === 'object') {
                const found = findDeepValue(v, keys);
                if (found !== undefined) {
                    return found;
                }
            }
        }
    }
    
    return undefined;
}

// Helper function to find all numeric values in an object
function findNumericValues(obj, path = '') {
    const numericValues = [];
    
    if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (typeof value === 'number') {
                numericValues.push({ path: currentPath, value });
            } else if (value && typeof value === 'object') {
                numericValues.push(...findNumericValues(value, currentPath));
            }
        }
    }
    
    return numericValues;
}

// Helper functions for viewer watch time tracking
function addViewer(userId, nickname, profilePic = null) {
    const now = new Date();
    
    // Check if we're processing this user too quickly (within 1 second)
    if (metrics.viewers[userId] && metrics.viewers[userId].lastSeen) {
        const timeSinceLastSeen = now - metrics.viewers[userId].lastSeen;
        if (timeSinceLastSeen < 1000) { // Less than 1 second
            console.log(`⏱️ [VIEWER] Skipping rapid re-add for ${nickname} (${userId}) - last seen ${timeSinceLastSeen}ms ago`);
            return;
        }
    }
    
                        if (!metrics.viewers[userId]) {
                metrics.viewers[userId] = {
                    userId: userId,
                    nickname: nickname,
                    profilePic: profilePic,
                    joinTime: now,
                    lastSeen: now,
                    watchTime: 0, // in seconds
                    isActive: true,
                    totalLikes: 0,
                    totalGifts: 0,
                    totalComments: 0,
                    totalShares: 0, // Track total shares
                    totalDiamonds: 0, // Track total diamonds spent
                    totalGiftValue: 0, // Track total USD value of gifts
                    isFollower: false, // Track follower status
                    followTime: null, // When they started following
            hasBeenWelcomed: false, // Track if AI has welcomed them
            welcomeTimestamp: null // Track when welcome was sent to prevent duplicates
                };
                metrics.viewerStats.totalUniqueViewers++;
                console.log(`👤 [VIEWER] New viewer joined: ${nickname} (${userId})`);
            } else {
                // Viewer rejoined, update last seen
                metrics.viewers[userId].lastSeen = now;
                metrics.viewers[userId].isActive = true;
                console.log(`👤 [VIEWER] Viewer rejoined: ${nickname} (${userId})`);
            }
    
    // Only broadcast viewer update for new viewers, not rejoins
    if (!metrics.viewers[userId] || !metrics.viewers[userId].hasBeenWelcomed) {
    broadcastEvent('viewerUpdate', {
        type: 'join',
        viewer: metrics.viewers[userId]
    });
    }
}

function updateViewerActivity(userId, activityType = 'activity') {
    if (metrics.viewers[userId]) {
        const now = new Date();
        metrics.viewers[userId].lastSeen = now;
        
        // Update activity-specific counters
        switch (activityType) {
            case 'like':
                metrics.viewers[userId].totalLikes++;
                break;
            case 'gift':
                metrics.viewers[userId].totalGifts++;
                // Note: totalDiamonds is updated separately in gift event handler
                break;
            case 'comment':
                metrics.viewers[userId].totalComments++;
                break;
            case 'follow':
                metrics.viewers[userId].isFollower = true;
                metrics.viewers[userId].followTime = new Date();
                break;
            case 'share':
                metrics.viewers[userId].totalShares++;
                break;
        }
        
        // Broadcast viewer activity update
        broadcastEvent('viewerActivity', {
            userId: userId,
            nickname: metrics.viewers[userId].nickname,
            activityType: activityType,
            timestamp: now
        });
    }
}

function updateViewerWatchTime() {
    const now = Date.now();
    
    Object.values(metrics.viewers).forEach(viewer => {
        if (viewer.isActive) {
            // Calculate watch time in seconds
            const watchTimeSeconds = Math.floor((now - viewer.joinTime) / 1000);
            viewer.watchTime = watchTimeSeconds;
        }
    });
    
    // Update viewer statistics
    updateViewerStats();
}

function updateViewerStats() {
    const activeViewers = Object.values(metrics.viewers).filter(v => v.isActive);
    
    if (activeViewers.length > 0) {
        // Calculate average watch time
        const totalWatchTime = activeViewers.reduce((sum, v) => sum + v.watchTime, 0);
        metrics.viewerStats.averageWatchTime = Math.floor(totalWatchTime / activeViewers.length);
        
        // Find longest watch time
        metrics.viewerStats.longestWatchTime = Math.max(...activeViewers.map(v => v.watchTime));
        
        // Categorize viewers by watch time
        metrics.viewerStats.viewersByWatchTime = {
            '0-5min': activeViewers.filter(v => v.watchTime < 300).length,
            '5-15min': activeViewers.filter(v => v.watchTime >= 300 && v.watchTime < 900).length,
            '15-30min': activeViewers.filter(v => v.watchTime >= 900 && v.watchTime < 1800).length,
            '30min+': activeViewers.filter(v => v.watchTime >= 1800).length
        };
    }
}

function removeInactiveViewers() {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
    
    Object.entries(metrics.viewers).forEach(([userId, viewer]) => {
        if (viewer.isActive && (now - viewer.lastSeen) > inactiveThreshold) {
            viewer.isActive = false;
            console.log(`👤 [VIEWER] Viewer marked inactive: ${viewer.nickname} (Watch time: ${Math.floor(viewer.watchTime / 60)}m ${viewer.watchTime % 60}s)`);
            
            // Broadcast viewer left
            broadcastEvent('viewerUpdate', {
                type: 'leave',
                viewer: viewer
            });
        }
    });
}

function formatWatchTime(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

// Get detailed viewer information
function getViewerDetails(userId) {
    return metrics.viewers[userId] || null;
}

// Centralized function to add new followers (prevents duplicates)
function addNewFollower(userId, nickname, profilePic) {
    if (!userId || !nickname) {
        console.log(`⚠️ [ADD FOLLOWER] Invalid data: userId=${userId}, nickname=${nickname}`);
        return;
    }
    
    // Initialize newFollowers array if it doesn't exist
    if (!metrics.newFollowers) {
        metrics.newFollowers = [];
    }
    
    // Check if this follower is already in the list
    const existingFollower = metrics.newFollowers.find(f => f.userId === userId);
    if (existingFollower) {
        console.log(`⚠️ [ADD FOLLOWER] ${nickname} (${userId}) already in newFollowers list - skipping duplicate`);
        return;
    }
    
    // Also check if we've already processed this follower in this session to prevent duplicates
    if (!metrics.processedFollowers) {
        metrics.processedFollowers = new Set();
    }
    
    if (metrics.processedFollowers.has(userId)) {
        console.log(`⚠️ [ADD FOLLOWER] ${nickname} (${userId}) already processed this session - skipping duplicate`);
        return;
    }
    
    // Mark this follower as processed for this session
    metrics.processedFollowers.add(userId);
    
    // Create follow data
    const followData = {
        userId,
        nickname,
        profilePic,
        timestamp: new Date(),
        followTime: new Date()
    };
    
    // Add to new followers list
    metrics.newFollowers.unshift(followData);
    if (metrics.newFollowers.length > 20) {
        metrics.newFollowers = metrics.newFollowers.slice(0, 20);
    }
    
    // Track for per-minute metrics
    followersGainedInLastMinute.push(Date.now());
    
    // Increment session followers gained
    metrics.sessionFollowersGained++;
    
    console.log(`✅ [ADD FOLLOWER] Added ${nickname} (${userId}) to newFollowers list`);
    console.log(`📊 [ADD FOLLOWER] New followers count: ${metrics.newFollowers.length}`);
    console.log(`📊 [ADD FOLLOWER] Followers gained this minute: ${followersGainedInLastMinute.length}`);
    console.log(`📊 [ADD FOLLOWER] Session total: ${metrics.sessionFollowersGained}`);
    
    // Broadcast follow event
    broadcastEvent('newFollower', followData);
}

// Clean up any existing duplicates in newFollowers array
function cleanupDuplicateFollowers() {
    if (!metrics.newFollowers || metrics.newFollowers.length === 0) {
        return;
    }
    
    console.log('🧹 [CLEANUP] Checking for duplicate followers...');
    const originalCount = metrics.newFollowers.length;
    
    // Use a Map to track unique userIds and keep the most recent entry
    const uniqueFollowers = new Map();
    
    for (const follower of metrics.newFollowers) {
        if (follower.userId && follower.nickname) {
            // If we already have this userId, keep the most recent one
            const existing = uniqueFollowers.get(follower.userId);
            if (!existing || follower.timestamp > existing.timestamp) {
                uniqueFollowers.set(follower.userId, follower);
            }
        }
    }
    
    // Convert back to array and sort by timestamp (newest first)
    metrics.newFollowers = Array.from(uniqueFollowers.values())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20); // Keep only top 20
    
    const cleanedCount = metrics.newFollowers.length;
    if (originalCount !== cleanedCount) {
        console.log(`🧹 [CLEANUP] Removed ${originalCount - cleanedCount} duplicate followers`);
        console.log(`🧹 [CLEANUP] Original: ${originalCount}, Cleaned: ${cleanedCount}`);
    } else {
        console.log('🧹 [CLEANUP] No duplicate followers found');
    }
}

// Get all active viewers
function getActiveViewers() {
    return Object.values(metrics.viewers).filter(v => v.isActive);
}

// Get viewer engagement ranking
function getViewerEngagementRanking() {
    const activeViewers = getActiveViewers();
    console.log(`🏆 [ENGAGEMENT] Calculating ranking for ${activeViewers.length} active viewers`);
    
    if (activeViewers.length === 0) {
        console.log('⚠️ [ENGAGEMENT] No active viewers found');
        return [];
    }
    
    const ranking = activeViewers
        .map(viewer => {
            // NEW ENGAGEMENT-BASED SCORING: Require actual engagement to qualify
            const likesScore = viewer.totalLikes * 8;           // Increased from 5
            const giftsScore = viewer.totalGifts * 50;          // Increased from 25 (gifts are premium)
            const commentsScore = viewer.totalComments * 15;    // Increased from 10
            const sharesScore = (viewer.totalShares || 0) * 20; // New: shares are valuable
            const diamondsScore = viewer.totalDiamonds * 1;     // Increased from 0.5
            const watchTimeScore = viewer.watchTime * 0.0001;   // Reduced from 0.001 (much less weight)
            
            // Calculate total engagement score
            const engagementScore = likesScore + giftsScore + commentsScore + sharesScore + diamondsScore + watchTimeScore;
            
            // Calculate engagement multiplier based on activity diversity
            let engagementMultiplier = 1.0;
            const hasLikes = viewer.totalLikes > 0;
            const hasGifts = viewer.totalGifts > 0;
            const hasComments = viewer.totalComments > 0;
            const hasShares = (viewer.totalShares || 0) > 0;
            
            // Bonus for multiple types of engagement
            const engagementTypes = [hasLikes, hasGifts, hasComments, hasShares].filter(Boolean).length;
            if (engagementTypes >= 3) engagementMultiplier = 1.5;      // 50% bonus for 3+ types
            else if (engagementTypes >= 2) engagementMultiplier = 1.25; // 25% bonus for 2 types
            
            // Apply engagement multiplier
            const finalScore = engagementScore * engagementMultiplier;
            
            return {
                userId: viewer.userId,
                nickname: viewer.nickname,
                profilePic: viewer.profilePic,
                watchTime: viewer.watchTime,
                totalLikes: viewer.totalLikes,
                totalGifts: viewer.totalGifts,
                totalComments: viewer.totalComments,
                totalShares: viewer.totalShares || 0,
                totalDiamonds: viewer.totalDiamonds || 0,
                isFollower: viewer.isFollower || false,
                followTime: viewer.followTime,
                engagementScore: finalScore,
                engagementMultiplier: engagementMultiplier,
                engagementTypes: engagementTypes
            };
        })
        .filter(viewer => {
            // FILTER: Only include viewers with actual engagement (no passive watchers)
            const hasEngagement = viewer.totalLikes > 0 || viewer.totalGifts > 0 || viewer.totalComments > 0 || (viewer.totalShares || 0) > 0;
            return hasEngagement;
        })
        .sort((a, b) => b.engagementScore - a.engagementScore);
    
    // If no viewers have engagement, show message
    if (ranking.length === 0) {
        console.log('🏆 [ENGAGEMENT] No viewers with engagement yet. Encourage likes, comments, and gifts!');
        return [];
    }
    
    // Debug: Log score breakdown for top 5 viewers with new scoring system
    console.log(`🏆 [ENGAGEMENT] Top 3 viewers:`, ranking.slice(0, 3).map(v => `${v.nickname} (Score: ${v.engagementScore.toFixed(1)})`));
    console.log('🏆 [SCORE BREAKDOWN] Top 5 viewers:');
    ranking.slice(0, 5).forEach((viewer, index) => {
        const likesScore = viewer.totalLikes * 8;
        const giftsScore = viewer.totalGifts * 50;
        const commentsScore = viewer.totalComments * 15;
        const sharesScore = (viewer.totalShares || 0) * 20;
        const diamondsScore = viewer.totalDiamonds * 1;
        const watchTimeScore = viewer.watchTime * 0.0001;
        const baseScore = likesScore + giftsScore + commentsScore + sharesScore + diamondsScore + watchTimeScore;
        
        console.log(`  ${index + 1}. ${viewer.nickname}: Likes(${viewer.totalLikes}×8=${likesScore}) + Gifts(${viewer.totalGifts}×50=${giftsScore}) + Comments(${viewer.totalComments}×15=${commentsScore}) + Shares(${(viewer.totalShares || 0)}×20=${sharesScore}) + Diamonds(${viewer.totalDiamonds}×1=${diamondsScore}) + WatchTime(${viewer.watchTime}s×0.0001=${watchTimeScore.toFixed(4)}) = ${baseScore.toFixed(1)} × ${viewer.engagementMultiplier} = ${viewer.engagementScore.toFixed(1)}`);
    });
    return ranking;
}

// Generate AI welcome messages and engagement tips for new viewers
function generateAIWelcome(nickname, viewerCount) {
    // Language-specific welcome messages
    const welcomeMessages = {
        en: [
        `Hey ${nickname}! 👋 Welcome to the stream! I'm so glad you're here!`,
        `Welcome ${nickname}! 🎉 You're joining us at the perfect time!`,
        `Hi ${nickname}! ✨ Great to see you in the chat!`,
        `Welcome aboard ${nickname}! 🚀 You're going to love this stream!`,
        `Hey there ${nickname}! 🌟 So happy you joined us!`
        ],
        fr: [
            `Salut ${nickname} ! 👋 Bienvenue sur le stream ! Je suis ravi que tu sois là !`,
            `Bienvenue ${nickname} ! 🎉 Tu nous rejoins au moment parfait !`,
            `Salut ${nickname} ! ✨ Ravi de te voir dans le chat !`,
            `Bienvenue à bord ${nickname} ! 🚀 Tu vas adorer ce stream !`,
            `Salut ${nickname} ! 🌟 Je suis content que tu nous aies rejoints !`
        ]
    };

    const engagementTips = {
        en: [
        `💡 **Tip**: Ask ${nickname} about their day or interests to build connection`,
        `💡 **Tip**: Encourage ${nickname} to drop a comment or like to stay engaged`,
        `💡 **Tip**: Share something personal to make ${nickname} feel welcome`,
        `💡 **Tip**: Ask ${nickname} if they've been to any interesting places lately`,
        `💡 **Tip**: Invite ${nickname} to share their thoughts on the current topic`
        ],
        fr: [
            `💡 **Conseil**: Demande à ${nickname} comment s'est passée sa journée ou ses centres d'intérêt pour créer un lien`,
            `💡 **Conseil**: Encourage ${nickname} à laisser un commentaire ou un like pour rester engagé`,
            `💡 **Conseil**: Partage quelque chose de personnel pour faire sentir ${nickname} bienvenu`,
            `💡 **Conseil**: Demande à ${nickname} s'il est allé dans des endroits intéressants récemment`,
            `💡 **Conseil**: Invite ${nickname} à partager ses pensées sur le sujet actuel`
        ]
    };

    const retentionStrategies = {
        en: [
        `🎯 **Retention**: With ${viewerCount} viewers, focus on personal connection`,
        `🎯 **Retention**: Early viewers like ${nickname} are your core audience`,
        `🎯 **Retention**: Build rapport with ${nickname} to increase watch time`,
        `🎯 **Retention**: Ask ${nickname} questions to keep them engaged`,
        `🎯 **Retention**: Share behind-the-scenes info to make ${nickname} feel special`
        ],
        fr: [
            `🎯 **Rétention**: Avec ${viewerCount} spectateurs, concentre-toi sur la connexion personnelle`,
            `🎯 **Rétention**: Les premiers spectateurs comme ${nickname} sont ton audience principale`,
            `🎯 **Rétention**: Crée un rapport avec ${nickname} pour augmenter le temps de visionnage`,
            `🎯 **Rétention**: Pose des questions à ${nickname} pour le garder engagé`,
            `🎯 **Rétention**: Partage des infos en coulisses pour faire sentir ${nickname} spécial`
        ]
    };

    // Get current language or default to English
    const lang = currentLanguage || 'en';
    
    // Select random messages in the current language
    const welcomeMessage = welcomeMessages[lang][Math.floor(Math.random() * welcomeMessages[lang].length)];
    const engagementTip = engagementTips[lang][Math.floor(Math.random() * engagementTips[lang].length)];
    const retentionStrategy = retentionStrategies[lang][Math.floor(Math.random() * retentionStrategies[lang].length)];

    return {
        welcomeMessage,
        engagementTips: [engagementTip, retentionStrategy],
        viewerCount,
        timestamp: new Date()
    };
}

// Extract totals from TikTok room info response (before connecting)
function extractRoomInfoTotals(roomInfo) {
    console.log('🎯 [ROOM INFO] Extracting totals from TikTok room info...');
    
    try {
        // Log the full room info to see what's available
        console.log('📊 [ROOM INFO] Full room info:', JSON.stringify(roomInfo, null, 2));
        
        let initialLikes = 0;
        let initialGifts = 0;
        let initialComments = 0;
        let initialViewers = 0;
        
        // Extract totals from various possible locations in room info
        // Check for likes count
        if (roomInfo.like_count && typeof roomInfo.like_count === 'number') {
            initialLikes = roomInfo.like_count;
        } else if (roomInfo.total_likes && typeof roomInfo.total_likes === 'number') {
            initialLikes = roomInfo.total_likes;
        } else if (roomInfo.stats && roomInfo.stats.like_count) {
            initialLikes = roomInfo.stats.like_count;
        } else if (roomInfo.room_data && roomInfo.room_data.like_count) {
            initialLikes = roomInfo.room_data.like_count;
        }
        
        // Check for gifts count
        if (roomInfo.gift_count && typeof roomInfo.gift_count === 'number') {
            initialGifts = roomInfo.gift_count;
        } else if (roomInfo.total_gifts && typeof roomInfo.total_gifts === 'number') {
            initialGifts = roomInfo.total_gifts;
        } else if (roomInfo.stats && roomInfo.stats.gift_count) {
            initialGifts = roomInfo.stats.gift_count;
        } else if (roomInfo.room_data && roomInfo.room_data.gift_count) {
            initialGifts = roomInfo.room_data.gift_count;
        }
        
        // Check for comments count
        if (roomInfo.comment_count && typeof roomInfo.comment_count === 'number') {
            initialComments = roomInfo.comment_count;
        } else if (roomInfo.total_comments && typeof roomInfo.total_comments === 'number') {
            initialComments = roomInfo.total_comments;
        } else if (roomInfo.stats && roomInfo.stats.comment_count) {
            initialComments = roomInfo.stats.comment_count;
        } else if (roomInfo.room_data && roomInfo.room_data.comment_count) {
            initialComments = roomInfo.room_data.comment_count;
        }
        
        // Check for viewer count
        if (roomInfo.user_count && typeof roomInfo.user_count === 'number') {
            initialViewers = roomInfo.user_count;
        } else if (roomInfo.viewer_count && typeof roomInfo.viewer_count === 'number') {
            initialViewers = roomInfo.viewer_count;
        } else if (roomInfo.stats && roomInfo.stats.user_count) {
            initialViewers = roomInfo.stats.user_count;
        } else if (roomInfo.room_data && roomInfo.room_data.user_count) {
            initialViewers = roomInfo.room_data.user_count;
        }
        
        // Deep search through the room info for any numeric values that might be totals
        if (initialLikes === 0) {
            const deepLikes = findDeepValue(roomInfo, ['like_count', 'total_likes', 'likes', 'likeCount']);
            if (deepLikes && typeof deepLikes === 'number' && deepLikes > 1000) { // Only consider large numbers as likely totals
                initialLikes = deepLikes;
            }
        }
        
        if (initialGifts === 0) {
            const deepGifts = findDeepValue(roomInfo, ['gift_count', 'total_gifts', 'gifts', 'giftCount']);
            if (deepGifts && typeof deepGifts === 'number') {
                initialGifts = deepGifts;
            }
        }
        
        if (initialComments === 0) {
            const deepComments = findDeepValue(roomInfo, ['comment_count', 'total_comments', 'comments', 'commentCount']);
            if (deepComments && typeof deepComments === 'number') {
                initialComments = deepComments;
            }
        }
        
        // Set the initial values if found
        if (initialLikes > 0) {
            metrics.totalLikes = initialLikes;
            console.log(`🎯 [ROOM INFO] Set total likes from room info: ${initialLikes.toLocaleString()}`);
        }
        
        if (initialGifts > 0) {
            metrics.totalGifts = initialGifts;
            console.log(`🎯 [ROOM INFO] Set total gifts from room info: ${initialGifts.toLocaleString()}`);
        }
        
        if (initialComments > 0) {
            metrics.totalComments = initialComments;
            console.log(`🎯 [ROOM INFO] Set total comments from room info: ${initialComments.toLocaleString()}`);
        }
        
        if (initialViewers > 0) {
            metrics.currentViewerCount = initialViewers;
            console.log(`🎯 [ROOM INFO] Set current viewer count from room info: ${initialViewers.toLocaleString()}`);
        }
        
        // Log all available keys in the room info object for debugging
        console.log('🔍 [ROOM INFO] Available keys:', Object.keys(roomInfo));
        if (roomInfo.stats) {
            console.log('🔍 [ROOM INFO] Stats keys:', Object.keys(roomInfo.stats));
        }
        if (roomInfo.room_data) {
            console.log('🔍 [ROOM INFO] Room data keys:', Object.keys(roomInfo.room_data));
        }
        if (roomInfo.owner) {
            console.log('🔍 [ROOM INFO] Owner keys:', Object.keys(roomInfo.owner));
        }
        
        // If we still don't have totals, try to find any large numbers that might be totals
        if (initialLikes === 0 || initialGifts === 0 || initialComments === 0) {
            console.log('🔍 [ROOM INFO] Searching for any large numbers that might be totals...');
            const allNumericValues = findNumericValues(roomInfo);
            const largeNumbers = allNumericValues.filter(val => val > 1000);
            if (largeNumbers.length > 0) {
                console.log('🎯 [ROOM INFO] Found large numbers that might be totals:', largeNumbers);
                // Try to intelligently assign these numbers
                if (initialLikes === 0 && largeNumbers.length > 0) {
                    const potentialLikes = largeNumbers.find(val => val > 10000); // Likes are usually the largest
                    if (potentialLikes) {
                        metrics.totalLikes = potentialLikes;
                        console.log(`🎯 [ROOM INFO] Assigned potential total likes: ${potentialLikes.toLocaleString()}`);
                    }
                }
            }
        }
        
        console.log('✅ [ROOM INFO] Room info totals extraction complete');
        
        // Broadcast updated metrics to dashboard (only if no sessions active)
        if (userSessions.size === 0) {
        broadcastMetrics();
        }
        
    } catch (error) {
        console.error('❌ [ROOM INFO] Error extracting room info totals:', error);
    }
}



// Extract keywords from comment for trend analysis
function extractKeywords(commentText) {
    const words = commentText.toLowerCase().split(/\s+/);
    const keywords = words.filter(word => 
        word.length > 3 && 
        !/^(the|and|but|for|are|was|were|been|have|has|had|will|would|could|should|this|that|with|from|they|them|their|there|here|when|where|what|why|how)$/i.test(word)
    );
    return keywords;
}

// Update keyword frequency tracking
function updateKeywordFrequency(keywords) {
    keywords.forEach(keyword => {
        if (!metrics.keywordFrequency[keyword]) {
            metrics.keywordFrequency[keyword] = 0;
        }
        metrics.keywordFrequency[keyword]++;
    });
}

// Calculate rolling sentiment average
function updateRollingSentiment(sentimentScore) {
    metrics.commentSentiments.push(sentimentScore);
    
    // Keep only last 100 sentiment scores
    if (metrics.commentSentiments.length > 100) {
        metrics.commentSentiments = metrics.commentSentiments.slice(-100);
    }
    
    // Calculate rolling average
    const sum = metrics.commentSentiments.reduce((a, b) => a + b, 0);
    metrics.rollingSentimentScore = sum / metrics.commentSentiments.length;
    
    // Update entertainment level when sentiment changes
    calculateEntertainmentLevel();
}

// ===== ENTERTAINMENT LEVEL ENGINE =====

// Calculate entertainment level based on multiple engagement factors
function calculateEntertainmentLevel() {
    const now = Date.now();
    let totalScore = 0;
    let maxScore = 0;
    
    // 1. ENGAGEMENT INTENSITY (30% weight)
    const engagementIntensity = calculateEngagementIntensity();
    const engagementScore = Math.min(engagementIntensity * 30, 30);
    totalScore += engagementScore;
    maxScore += 30;
    
    // 2. CONTENT RECEPTION (25% weight)
    const contentReception = calculateContentReception();
    const contentScore = Math.min(contentReception * 25, 25);
    totalScore += contentScore;
    maxScore += 25;
    
    // 3. AUDIENCE ENERGY (25% weight)
    const audienceEnergy = calculateAudienceEnergy();
    const energyScore = Math.min(audienceEnergy * 25, 25);
    totalScore += energyScore;
    maxScore += 25;
    
    // 4. RETENTION QUALITY (20% weight)
    const retentionQuality = calculateRetentionQuality();
    const retentionScore = Math.min(retentionQuality * 20, 20);
    totalScore += retentionScore;
    maxScore += 20;
    
    // Calculate final entertainment score (0-100)
    const entertainmentScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    // Update entertainment metrics
    metrics.entertainmentMetrics.entertainmentScore = entertainmentScore;
    metrics.entertainmentMetrics.engagementIntensity = engagementIntensity;
    metrics.entertainmentMetrics.contentReception = contentReception;
    metrics.entertainmentMetrics.audienceEnergy = audienceEnergy;
    metrics.entertainmentMetrics.retentionQuality = retentionQuality;
    metrics.entertainmentMetrics.lastEntertainmentUpdate = new Date();
    
    console.log(`🎭 [ENTERTAINMENT] Score: ${entertainmentScore}/100 | Engagement: ${engagementIntensity.toFixed(2)} | Content: ${contentReception.toFixed(2)} | Energy: ${audienceEnergy.toFixed(2)} | Retention: ${retentionQuality.toFixed(2)}`);
    
    return entertainmentScore;
}

// Calculate engagement intensity (0-1 scale)
function calculateEngagementIntensity() {
    const currentViewers = metrics.currentViewerCount || 1;
    
    // Normalize engagement metrics per viewer
    const likesPerViewer = (metrics.likesPerMinute || 0) / currentViewers;
    const commentsPerViewer = (metrics.commentsPerMinute || 0) / currentViewers;
    const giftsPerViewer = (metrics.giftsPerMinute || 0) / currentViewers;
    
    // Weight different engagement types
    const weightedEngagement = (likesPerViewer * 0.4) + (commentsPerViewer * 0.4) + (giftsPerViewer * 0.2);
    
    // Normalize to 0-1 scale (adjust thresholds based on your stream performance)
    const normalizedEngagement = Math.min(weightedEngagement / 0.5, 1);
    
    return Math.max(0, normalizedEngagement);
}

// Calculate content reception quality (0-1 scale)
function calculateContentReception() {
    let receptionScore = 0;
    
    // 1. Sentiment quality (40% weight)
    if (metrics.commentSentiments.length >= 10) {
        const recentSentiments = metrics.commentSentiments.slice(-10);
        const positiveComments = recentSentiments.filter(s => s > 0).length;
        const sentimentQuality = positiveComments / recentSentiments.length;
        receptionScore += sentimentQuality * 0.4;
    }
    
    // 2. Comment quality (30% weight)
    if (metrics.recentComments.length >= 5) {
        const recentComments = metrics.recentComments.slice(-5);
        const qualityComments = recentComments.filter(c => 
            c.comment && c.comment.length > 10 && !c.comment.includes('?') && !c.comment.includes('!')
        ).length;
        const commentQuality = qualityComments / recentComments.length;
        receptionScore += commentQuality * 0.3;
    }
    
    // 3. Gift frequency (30% weight)
    const giftFrequency = Math.min((metrics.giftsPerMinute || 0) / 10, 1); // Normalize to 0-1
    receptionScore += giftFrequency * 0.3;
    
    return Math.min(receptionScore, 1);
}

// Calculate audience energy level (0-1 scale)
function calculateAudienceEnergy() {
    let energyScore = 0;
    
    // 1. Rapid engagement (40% weight)
    const rapidEngagement = Math.min((metrics.likesPerMinute + metrics.commentsPerMinute) / 50, 1);
    energyScore += rapidEngagement * 0.4;
    
    // 2. Viewer growth momentum (30% weight)
    if (metrics.viewerHistory.length >= 5) {
        const recentViewers = metrics.viewerHistory.slice(-5);
        const growthMomentum = recentViewers[recentViewers.length - 1].count - recentViewers[0].count;
        const normalizedGrowth = Math.min(Math.max(growthMomentum / 10, 0), 1);
        energyScore += normalizedGrowth * 0.3;
    }
    
    // 3. Active participation (30% weight)
    const activeParticipation = Math.min((metrics.recentComments.length + metrics.recentLikes.length) / 20, 1);
    energyScore += activeParticipation * 0.3;
    
    return Math.min(energyScore, 1);
}

// Calculate retention quality (0-1 scale)
function calculateRetentionQuality() {
    if (metrics.viewerHistory.length < 10) return 0.5; // Default assumption
    
    const recentViewers = metrics.viewerHistory.slice(-10);
    const avgViewers = recentViewers.reduce((sum, entry) => sum + entry.count, 0) / recentViewers.length;
    
    // Calculate stability (less variance = better retention)
    const variance = recentViewers.reduce((sum, entry) => sum + Math.pow(entry.count - avgViewers, 2), 0) / recentViewers.length;
    const stability = Math.max(0, 1 - (variance / Math.pow(avgViewers, 2)));
    
    // Factor in viewer count (higher counts = better retention potential)
    const countFactor = Math.min(avgViewers / 100, 1);
    
    return (stability * 0.7) + (countFactor * 0.3);
}

// ===== PREDICTIVE ANALYTICS ENGINE =====

// Main predictive analytics function
function runPredictiveAnalytics() {
    const insights = {
        churnRisk: null,
        monetizationOpportunity: null
    };
    
    // Update predictive metrics
    updatePredictiveMetrics();
    
    // Check for churn risk
    const churnRisk = predictChurnRisk();
    if (churnRisk.risk > 70) {
        insights.churnRisk = {
            type: 'prediction_churn',
            priority: 'critical',
            message: `🚨 [PREDICTIVE] High churn risk detected (${churnRisk.risk}%) due to ${churnRisk.factors.join(', ')}. Suggested action: ${churnRisk.suggestedActions.join(' or ')}`,
            trigger: 'prediction_churn',
            action: 'prevent_churn',
            score: churnRisk.risk,
            confidence: churnRisk.confidence,
            timeToChurn: churnRisk.timeToChurn
        };
    }
    
    // Check for monetization opportunities
    const monetizationOpportunity = predictMonetizationOpportunity();
    if (monetizationOpportunity.opportunity > 75) {
        insights.monetizationOpportunity = {
            type: 'prediction_monetization',
            priority: 'high',
            message: `💰 [PREDICTIVE] High-value monetization opportunity (${monetizationOpportunity.opportunity}%) due to ${monetizationOpportunity.factors.join(', ')}. Suggested action: ${monetizationOpportunity.suggestedActions.join(' or ')}`,
            trigger: 'prediction_monetization',
            action: 'capitalize_opportunity',
            score: monetizationOpportunity.opportunity,
            confidence: monetizationOpportunity.confidence,
            expectedValue: monetizationOpportunity.expectedValue
        };
    }
    
    return insights;
}

// Churn prediction model
function predictChurnRisk() {
    const now = Date.now();
    const riskFactors = [];
    const suggestedActions = [];
    let totalRisk = 0;
    
    // 1. Viewer count decline trend
    if (metrics.viewerHistory.length >= 10) {
        const recentViewers = metrics.viewerHistory.slice(-10);
        const declineRate = calculateDeclineRate(recentViewers.map(v => v.count));
        if (declineRate > 0.1) { // 10% decline
            riskFactors.push(`Viewer count declining at ${(declineRate * 100).toFixed(1)}% per minute`);
            suggestedActions.push('Engage viewers with a quick poll or question to boost retention');
            totalRisk += Math.min(declineRate * 200, 40); // Max 40 points
        }
    }
    
    // 2. Engagement drop
    const currentEngagement = (metrics.likesPerMinute + metrics.commentsPerMinute * 2) / 3;
    const avgEngagement = calculateAverageEngagement();
    if (currentEngagement < avgEngagement * 0.6) {
        riskFactors.push(`Engagement ${((avgEngagement - currentEngagement) / avgEngagement * 100).toFixed(1)}% below average`);
        suggestedActions.push('Call for likes or comments to re-engage the audience');
        totalRisk += 25;
    }
    
    // 3. Sentiment decline
    if (metrics.commentSentiments.length >= 20) {
        const recentSentiment = metrics.commentSentiments.slice(-10);
        const avgRecentSentiment = recentSentiment.reduce((a, b) => a + b, 0) / recentSentiment.length;
        const overallSentiment = metrics.rollingSentimentScore;
        if (avgRecentSentiment < overallSentiment - 1) {
            riskFactors.push(`Recent sentiment ${(overallSentiment - avgRecentSentiment).toFixed(1)} points below average`);
            suggestedActions.push('Shift to positive topics or share an uplifting story');
            totalRisk += 20;
        }
    }
    
    // 4. Chat silence
    const lastCommentTime = metrics.recentComments.length > 0 ? 
        metrics.recentComments[metrics.recentComments.length - 1].timestamp.getTime() : 0;
    const silenceDuration = (now - lastCommentTime) / 1000 / 60; // minutes
    if (silenceDuration > 3) {
        riskFactors.push(`Chat silent for ${silenceDuration.toFixed(1)} minutes`);
        suggestedActions.push('Ask an open-ended question to restart conversation');
        totalRisk += Math.min(silenceDuration * 8, 30); // Max 30 points
    }
    
    // 5. User retention drop
    const retentionRate = calculateUserRetentionRate();
    if (retentionRate < 0.7) { // Less than 70% retention
        riskFactors.push(`User retention at ${(retentionRate * 100).toFixed(1)}%`);
        suggestedActions.push('Highlight upcoming content to encourage staying');
        totalRisk += 15;
    }
    
    // Calculate confidence based on data quality
    const confidence = Math.min(metrics.recentComments.length / 50, 1) * 100;
    
    // Estimate time to churn (in minutes)
    let timeToChurn = 15; // Default 15 minutes
    if (totalRisk > 80) timeToChurn = 5;
    else if (totalRisk > 60) timeToChurn = 10;
    else if (totalRisk > 40) timeToChurn = 20;
    
    return {
        risk: Math.min(totalRisk, 100),
        confidence: Math.round(confidence),
        factors: riskFactors,
        suggestedActions: suggestedActions,
        timeToChurn: timeToChurn
    };
}

// Monetization opportunity prediction
function predictMonetizationOpportunity() {
    const now = Date.now();
    const opportunityFactors = [];
    const suggestedActions = [];
    let totalOpportunity = 0;
    
    // 1. High engagement moment
    const currentEngagement = (metrics.likesPerMinute + metrics.commentsPerMinute * 2) / 3;
    const avgEngagement = calculateAverageEngagement();
    if (currentEngagement > avgEngagement * 1.5) {
        opportunityFactors.push(`Engagement ${((currentEngagement - avgEngagement) / avgEngagement * 100).toFixed(1)}% above average`);
        suggestedActions.push('Promote gifts or subscriptions now while engagement is high');
        totalOpportunity += 30;
    }
    
    // 2. Positive sentiment spike
    if (metrics.commentSentiments.length >= 10) {
        const recentSentiment = metrics.commentSentiments.slice(-5);
        const avgRecentSentiment = recentSentiment.reduce((a, b) => a + b, 0) / recentSentiment.length;
        if (avgRecentSentiment > 1.5) {
            opportunityFactors.push(`Very positive sentiment (${avgRecentSentiment.toFixed(1)})`);
            suggestedActions.push('Leverage positive mood for gift challenges or shoutouts');
            totalOpportunity += 25;
        }
    }
    
    // 3. Gift correlation patterns
    const giftCorrelation = analyzeGiftCorrelation();
    if (giftCorrelation.correlation > 0.7) {
        opportunityFactors.push(`Strong gift correlation with current content`);
        suggestedActions.push('Continue current content and subtly encourage gifts');
        totalOpportunity += 20;
    }
    
    // 4. Viewer count stability/growth
    if (metrics.viewerHistory.length >= 5) {
        const recentViewers = metrics.viewerHistory.slice(-5);
        const growthRate = calculateGrowthRate(recentViewers.map(v => v.count));
        if (growthRate > 0.05) { // 5% growth
            opportunityFactors.push(`Viewer count growing at ${(growthRate * 100).toFixed(1)}% per minute`);
            suggestedActions.push('Capitalize on growth with a gift goal for special content');
            totalOpportunity += 15;
        }
    }
    
    // 5. Content performance history
    const contentPerformance = analyzeContentPerformance();
    if (contentPerformance.score > 0.8) {
        opportunityFactors.push(`Current content type historically performs well`);
        suggestedActions.push('Extend this content segment and promote monetization');
        totalOpportunity += 10;
    }
    
    // Calculate confidence
    const confidence = Math.min(metrics.recentComments.length / 30, 1) * 100;
    
    // Estimate expected value
    const expectedValue = Math.round(totalOpportunity * (metrics.currentViewerCount / 100));
    
    return {
        opportunity: Math.min(totalOpportunity, 100),
        confidence: Math.round(confidence),
        factors: opportunityFactors,
        suggestedActions: suggestedActions,
        expectedValue: expectedValue
    };
}

// Helper functions for predictive analytics
function updatePredictiveMetrics() {
    // Update churn risk score
    const churnRisk = predictChurnRisk();
    metrics.predictiveMetrics.churnRiskScore = churnRisk.risk;
    
    // Update monetization opportunity score
    const monetizationOpportunity = predictMonetizationOpportunity();
    metrics.predictiveMetrics.monetizationOpportunityScore = monetizationOpportunity.opportunity;
    
    // Update engagement trend
    metrics.predictiveMetrics.engagementTrend = determineEngagementTrend();
    
    // Update viewer retention rate
    metrics.predictiveMetrics.viewerRetentionRate = calculateUserRetentionRate();
    
    // Update sentiment volatility
    metrics.predictiveMetrics.sentimentVolatility = calculateSentimentVolatility();
    
    // Update last update time
    metrics.predictiveMetrics.lastUpdate = new Date();
}

function calculateDeclineRate(values) {
    if (values.length < 2) return 0;
    const first = values[0];
    const last = values[values.length - 1];
    return (first - last) / first;
}

function calculateGrowthRate(values) {
    if (values.length < 2) return 0;
    const first = values[0];
    const last = values[values.length - 1];
    return (last - first) / first;
}

function calculateAverageEngagement() {
    const recentHistory = metrics.viewerHistory.slice(-20);
    if (recentHistory.length === 0) return 0;
    
    let totalEngagement = 0;
    let count = 0;
    
    recentHistory.forEach((entry, index) => {
        if (index > 0) {
            const prevEntry = recentHistory[index - 1];
            const timeDiff = (entry.timestamp - prevEntry.timestamp) / 1000 / 60; // minutes
            if (timeDiff > 0) {
                totalEngagement += (entry.count - prevEntry.count) / timeDiff;
                count++;
            }
        }
    });
    
    return count > 0 ? totalEngagement / count : 0;
}

function calculateUserRetentionRate() {
    if (metrics.viewerHistory.length < 10) return 0.8; // Default assumption
    
    const recentViewers = metrics.viewerHistory.slice(-10);
    const totalViewers = recentViewers.reduce((sum, entry) => sum + entry.count, 0);
    const avgViewers = totalViewers / recentViewers.length;
    
    // Simple retention calculation based on viewer stability
    const variance = recentViewers.reduce((sum, entry) => sum + Math.pow(entry.count - avgViewers, 2), 0) / recentViewers.length;
    const stability = Math.max(0, 1 - (variance / Math.pow(avgViewers, 2)));
    
    return Math.max(0.3, Math.min(1, stability)); // Between 30% and 100%
}

function calculateSentimentVolatility() {
    if (metrics.commentSentiments.length < 10) return 0;
    
    const recentSentiments = metrics.commentSentiments.slice(-10);
    const avgSentiment = recentSentiments.reduce((a, b) => a + b, 0) / recentSentiments.length;
    const variance = recentSentiments.reduce((sum, sentiment) => sum + Math.pow(sentiment - avgSentiment, 2), 0) / recentSentiments.length;
    
    return Math.sqrt(variance);
}

function determineEngagementTrend() {
    const churnRisk = metrics.predictiveMetrics.churnRiskScore;
    const monetizationOpportunity = metrics.predictiveMetrics.monetizationOpportunityScore;
    
    if (churnRisk > 80) return 'critical';
    if (churnRisk > 60) return 'declining';
    if (monetizationOpportunity > 75) return 'increasing';
    return 'stable';
}

function analyzeGiftCorrelation() {
    if (metrics.recentGifts.length < 5) return { correlation: 0, confidence: 0 };
    
    const now = Date.now();
    // Simple correlation between gifts and current engagement
    const currentEngagement = metrics.likesPerMinute + metrics.commentsPerMinute;
    const recentGiftCount = metrics.recentGifts.filter(gift => 
        (now - gift.timestamp.getTime()) < 300000 // Last 5 minutes
    ).length;
    
    // Basic correlation calculation
    const correlation = Math.min(recentGiftCount / Math.max(currentEngagement, 1), 1);
    
    return {
        correlation: correlation,
        confidence: Math.min(metrics.recentGifts.length / 10, 1) * 100
    };
}

function analyzeContentPerformance() {
    // This would analyze what type of content is currently being discussed
    // For now, return a basic score based on current engagement
    const currentEngagement = (metrics.likesPerMinute + metrics.commentsPerMinute * 2) / 3;
    const avgEngagement = calculateAverageEngagement();
    
    if (avgEngagement === 0) return { score: 0.5, type: 'unknown' };
    
    const performanceRatio = currentEngagement / avgEngagement;
    const score = Math.min(performanceRatio, 2) / 2; // Normalize to 0-1
    
    return {
        score: score,
        type: score > 0.8 ? 'high_performance' : score > 0.6 ? 'medium_performance' : 'low_performance'
    };
}

// ===== QUESTION DETECTION ENGINE =====

// Detect questions in chat comments
function detectQuestions(comment, userId, nickname) {
    const questionPatterns = [
        // Direct questions
        /\?$/, // Ends with question mark
        /^(what|how|why|when|where|who|which|can|could|would|will|do|does|did|is|are|was|were|have|has|had)\b/i, // Question words
        /^(are you|do you|can you|would you|will you|have you|did you)\b/i, // Question phrases
        /^(tell me|explain|describe|show me|help me)\b/i, // Request phrases
        
        // French question patterns
        /^(comment|pourquoi|quand|où|qui|quel|quelle|peux|peut|veux|veut|as|est|es|sont|avez|ont)\b/i,
        /^(peux-tu|peut-on|veux-tu|veut-il|as-tu|est-ce|es-tu|avez-vous|ont-ils)\b/i,
        
        // Spanish question patterns
        /^(cómo|por qué|cuándo|dónde|quién|cuál|puedes|quieres|tienes|eres|estás|tienes|tienen)\b/i,
        
        // Question indicators
        /^(i wonder|i want to know|i'm curious|i'd like to know|can someone|does anyone)\b/i,
        /^(help|advice|suggestion|tip|recommendation)\b/i
    ];
    
    // Check if comment contains question patterns
    const isQuestion = questionPatterns.some(pattern => pattern.test(comment.trim()));
    
    if (isQuestion) {
        const questionData = {
            id: Date.now() + Math.random(),
            userId: userId,
            nickname: nickname,
            question: comment.trim(),
            timestamp: new Date(),
            priority: calculateQuestionPriority(comment),
            status: 'pending', // 'pending', 'answered', 'ignored'
            responseTime: null,
            likes: 0,
            replies: 0
        };
        
        // Add to pending questions
        metrics.questionDetection.pendingQuestions.push(questionData);
        
        // Keep only last 20 pending questions
        if (metrics.questionDetection.pendingQuestions.length > 20) {
            metrics.questionDetection.pendingQuestions = metrics.questionDetection.pendingQuestions.slice(-20);
        }
        
        // Update question stats
        updateQuestionStats();
        
        console.log(`❓ [QUESTION DETECTED] ${nickname}: "${comment}" (Priority: ${questionData.priority})`);
        
        // Broadcast question to dashboard
        broadcastEvent('questionDetected', questionData);
        
        return questionData;
    }
    
    return null;
}

// Calculate question priority based on content and context
function calculateQuestionPriority(question) {
    let priority = 1; // Base priority
    
    // High priority indicators
    if (/\b(urgent|help|emergency|problem|issue|broken|error|crash)\b/i.test(question)) {
        priority += 3;
    }
    
    // Personal questions (higher engagement)
    if (/\b(you|your|streamer|stream|content|game|opinion|think|feel)\b/i.test(question)) {
        priority += 2;
    }
    
    // Technical questions
    if (/\b(how to|tutorial|guide|explain|teach|learn|setup|config|settings)\b/i.test(question)) {
        priority += 2;
    }
    
    // Community questions
    if (/\b(we|us|everyone|chat|community|group|team)\b/i.test(question)) {
        priority += 1;
    }
    
    // Question urgency (multiple question marks)
    const questionMarks = (question.match(/\?/g) || []).length;
    priority += Math.min(questionMarks, 2);
    
    return Math.min(priority, 5); // Max priority 5
}

// Mark question as answered
function markQuestionAnswered(questionId) {
    const questionIndex = metrics.questionDetection.pendingQuestions.findIndex(q => q.id === questionId);
    
    if (questionIndex !== -1) {
        const question = metrics.questionDetection.pendingQuestions[questionIndex];
        question.status = 'answered';
        question.responseTime = Date.now() - question.timestamp.getTime();
        
        // Move to answered questions
        metrics.questionDetection.answeredQuestions.push(question);
        metrics.questionDetection.pendingQuestions.splice(questionIndex, 1);
        
        // Keep only last 50 answered questions
        if (metrics.questionDetection.answeredQuestions.length > 50) {
            metrics.questionDetection.answeredQuestions = metrics.questionDetection.answeredQuestions.slice(-50);
        }
        
        // Update stats
        updateQuestionStats();
        
        console.log(`✅ [QUESTION ANSWERED] ${question.nickname}: "${question.question}"`);
        
        // Broadcast update
        broadcastEvent('questionAnswered', question);
        
        return question;
    }
    
    return null;
}

// Update question statistics
function updateQuestionStats() {
    const stats = metrics.questionDetection.questionStats;
    const pending = metrics.questionDetection.pendingQuestions.length;
    const answered = metrics.questionDetection.answeredQuestions.length;
    
    stats.totalQuestions = pending + answered;
    stats.answeredQuestions = answered;
    stats.responseRate = stats.totalQuestions > 0 ? (answered / stats.totalQuestions) * 100 : 0;
    
    // Calculate average response time
    if (answered > 0) {
        const totalResponseTime = metrics.questionDetection.answeredQuestions.reduce((sum, q) => sum + (q.responseTime || 0), 0);
        stats.averageResponseTime = totalResponseTime / answered;
    }
    
    metrics.questionDetection.lastQuestionUpdate = new Date();
}

// Generate automated prompts using AI service with fallback to legacy system
async function generateAutomatedPrompt(session = null) {
    const now = Date.now();
    
    // Use session-specific metrics if session is provided, otherwise use global metrics
    const targetMetrics = session ? session.metrics : metrics;
    const sessionId = session ? session.id : 'global';
    
    // Check cooldown to prevent spam - reduced from 30s to 15s for more proactive assistance
    if (targetMetrics.lastPromptTime && (now - targetMetrics.lastPromptTime) < 15000) { // 15 second cooldown
        return null;
    }
    
    try {
        // Try AI service first
        console.log(`🤖 [AI] Calling Gemini service for prompt generation... (Session: ${sessionId})`);
        const aiPrompt = await geminiService.generatePrompt(targetMetrics, currentLanguage);
        
        if (aiPrompt && aiPrompt.message) {
            console.log('🤖 [AI] Successfully generated AI prompt:', aiPrompt.message);
            
            // Check if this is a fallback prompt that needs translation
            let finalMessage = aiPrompt.message;
            if (aiPrompt.source === 'context_aware_fallback' && promptTranslations[currentLanguage] && promptTranslations[currentLanguage][aiPrompt.message]) {
                // This is a fallback prompt with a translation key, translate it
                finalMessage = promptTranslations[currentLanguage][aiPrompt.message];
                console.log(`🌍 [TRANSLATION] Translated fallback prompt to ${currentLanguage}:`, finalMessage);
            }
            
            // Ensure the AI prompt has all required properties
            const enhancedPrompt = {
                ...aiPrompt,
                message: finalMessage, // Use translated message if available
                source: 'gemini',
                type: aiPrompt.type || 'ai_generated',
                priority: aiPrompt.priority || 'medium',
                trigger: aiPrompt.trigger || 'ai_service',
                action: aiPrompt.action || 'general_guidance'
            };
            
            // Update cooldown tracking
            targetMetrics.lastPromptTime = now;
            if (!targetMetrics.promptCooldowns) targetMetrics.promptCooldowns = {};
            targetMetrics.promptCooldowns[enhancedPrompt.trigger] = now;
            
            // Update prompt history
            if (!targetMetrics.promptHistory) targetMetrics.promptHistory = [];
            targetMetrics.promptHistory.push(enhancedPrompt.trigger);
            if (targetMetrics.promptHistory.length > 10) {
                targetMetrics.promptHistory.shift();
            }
            
            return enhancedPrompt;
        }
    } catch (error) {
        console.error('🤖 [AI] Error calling Gemini service:', error);
        console.log('🤖 [AI] Falling back to legacy prompt system...');
    }
    
    // Fallback to legacy system
    console.log('🤖 [LEGACY] Using legacy prompt generation system...');
    
    // Check if we have recent new viewers that need engagement tips
    const recentNewViewers = Object.values(targetMetrics.viewers || {})
        .filter(v => v.hasBeenWelcomed && 
                    v.welcomeTimestamp && 
                    (now - v.welcomeTimestamp) < 300000) // Last 5 minutes
        .sort((a, b) => b.welcomeTimestamp - a.welcomeTimestamp)
        .slice(0, 2); // Get 2 most recent new viewers
    
    // Skip comprehensive viewer prompts if they were recently sent via aiWelcome events
    if (recentNewViewers.length > 0) {
        console.log(`🤖 [LIVE ASSISTANT] Skipping comprehensive prompts for recent viewers (already sent via aiWelcome): ${recentNewViewers.map(v => v.nickname).join(', ')}`);
        
        // Instead, generate AI-enhanced engagement content for other scenarios
        return generateAIEnhancedContent(targetMetrics);
    }
    
    // If no recent new viewers, generate AI-enhanced content
    return generateAIEnhancedContent(targetMetrics);
}

// Enhanced AI content generation for Live Assistant
function generateAIEnhancedContent(targetMetrics = metrics) {
    const now = Date.now();
    const prompts = [];
    
    console.log(`🤖 [LEGACY] Generating AI-enhanced fallback prompt...`);
    
    // Helper to get top keyword
    const topKeyword = Object.entries(targetMetrics.keywordFrequency || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'general';
    
    // Helper to get top engager
    const topEngager = getViewerEngagementRanking()[0]?.nickname || 'viewers';
    
    // Get current stream metrics
    const viewerCount = targetMetrics.currentViewerCount || 0;
        const likeRate = targetMetrics.likesPerMinute || 0;
    const commentRate = targetMetrics.commentsPerMinute || 0;
    const giftRate = targetMetrics.giftsPerMinute || 0;
    
    // Check if we have any active viewers to engage with
    const activeViewers = Object.values(targetMetrics.viewers || {}).filter(v => v.isActive && v.lastSeen > (now - 300000)); // Active in last 5 minutes
    const recentViewers = activeViewers.slice(0, 3); // Get up to 3 recent active viewers
    
    if (recentViewers.length > 0) {
        // Generate AI-powered engagement content for active viewers
        const targetViewer = recentViewers[0];
        const aiWelcomeData = generateAIWelcome(targetViewer.nickname, viewerCount);
        
        // Create comprehensive engagement prompt for active viewers
        const comprehensivePrompt = {
            type: 'active_viewer_engagement',
            priority: 'high',
            message: `${aiWelcomeData.welcomeMessage}\n\n${aiWelcomeData.engagementTips.join('\n\n')}`,
            trigger: 'active_viewer_engagement',
            action: 'engage_active_viewer',
            source: 'ai_enhanced_legacy',
            targetViewer: targetViewer.nickname,
            timestamp: new Date(),
            welcomeMessage: aiWelcomeData.welcomeMessage,
            engagementTips: aiWelcomeData.engagementTips,
            retentionStrategies: aiWelcomeData.retentionStrategies,
            viewerCount: aiWelcomeData.viewerCount
        };
        
        console.log(`🤖 [AI ENHANCED] Generated engagement content for active viewer ${comprehensivePrompt.targetViewer}`);
        return comprehensivePrompt;
    }
    
    // If no active viewers, generate context-aware AI prompts with specific actions
    if (commentRate < 5 && viewerCount > 0) {
            prompts.push({
                type: 'engagement',
                priority: 'high',
                message: getTranslatedPrompt('chatActivation', { viewerCount, commentRate }),
                trigger: 'ai_enhanced_low_engagement',
                action: 'boost_engagement',
                source: 'ai_enhanced_legacy'
            });
    } else if (likeRate < 10 && viewerCount > 0) {
            prompts.push({
                type: 'engagement',
                priority: 'medium',
                message: getTranslatedPrompt('likeBoost', { likeRate, viewerCount }),
                trigger: 'ai_enhanced_low_likes',
                action: 'encourage_likes',
                source: 'ai_enhanced_legacy'
            });
    } else if (viewerCount > 100) {
            prompts.push({
                type: 'growth',
                priority: 'medium',
                message: getTranslatedPrompt('communityGrowth', { viewerCount }),
                trigger: 'ai_enhanced_growth',
                action: 'encourage_growth',
                source: 'ai_enhanced_legacy'
            });
    } else {
        // Analyze actual engagement levels for more accurate AI-enhanced prompts
        const engagementLevel = analyzeActualEngagement();
        
        if (engagementLevel === 'low') {
        prompts.push({
                type: 'engagement',
            priority: 'high',
                message: getTranslatedPrompt('aiEngagementBoost', { viewerCount }),
                trigger: 'ai_enhanced_low_engagement_accurate',
                action: 'boost_engagement',
                source: 'ai_enhanced_legacy'
            });
        } else if (engagementLevel === 'medium') {
        prompts.push({
                type: 'interaction',
            priority: 'medium',
                message: getTranslatedPrompt('aiInteraction', {}),
                trigger: 'ai_enhanced_medium_engagement',
                action: 'encourage_sharing',
                source: 'ai_enhanced_legacy'
            });
        } else {
        prompts.push({
                type: 'interaction',
            priority: 'medium',
                message: getTranslatedPrompt('aiMomentum', {}),
                trigger: 'ai_enhanced_good_engagement',
                action: 'start_challenge',
                source: 'ai_enhanced_legacy'
            });
        }
    }
    
    // Return first available AI-enhanced prompt
    if (prompts.length > 0) {
        const selectedPrompt = prompts[0];
        
        // Update cooldown tracking
        metrics.lastPromptTime = now;
        if (!metrics.promptCooldowns) metrics.promptCooldowns = {};
        metrics.promptCooldowns[selectedPrompt.trigger] = now;
        
        // Update prompt history
        if (!metrics.promptHistory) metrics.promptHistory = [];
        metrics.promptHistory.push(selectedPrompt.trigger);
        if (metrics.promptHistory.length > 10) {
            metrics.promptHistory.shift();
        }
        
        return selectedPrompt;
    }
    
    // Final fallback - generate a generic but AI-styled prompt
    return {
        type: 'general_engagement',
        priority: 'medium',
        message: `💡 **AI Suggestion**: With ${viewerCount} viewers, focus on building personal connections. Ask questions, share experiences, and encourage interaction to boost engagement!`,
        trigger: 'ai_enhanced_generic',
        action: 'general_engagement',
        source: 'ai_enhanced_legacy',
        timestamp: new Date()
    };
}

// Analyze actual engagement levels for accurate fallback prompts
function analyzeActualEngagement() {
        const viewerCount = metrics.currentViewerCount || 0;
        const likeRate = metrics.likesPerMinute || 0;
        const commentRate = metrics.commentsPerMinute || 0;
    const giftRate = metrics.giftsPerMinute || 0;
    
    // Calculate engagement score (weighted average)
    const engagementScore = (likeRate * 0.4) + (commentRate * 0.4) + (giftRate * 0.2);
    
    // Normalize by viewer count to get per-viewer engagement
    const perViewerEngagement = viewerCount > 0 ? engagementScore / viewerCount : 0;
    
    console.log(`🤖 [ENGAGEMENT] Analysis - Viewers: ${viewerCount}, Like Rate: ${likeRate}/min, Comment Rate: ${commentRate}/min, Gift Rate: ${giftRate}/min`);
    console.log(`🤖 [ENGAGEMENT] Calculated engagement score: ${engagementScore.toFixed(2)}, Per-viewer: ${perViewerEngagement.toFixed(4)}`);
    
    // Define engagement thresholds
    if (perViewerEngagement < 0.1 || engagementScore < 5) {
        return 'low';
    } else if (perViewerEngagement < 0.3 || engagementScore < 15) {
        return 'medium';
        } else {
        return 'high';
    }
}

// Analyze engagement trends over time
function analyzeEngagementTrend() {
    if (metrics.recentComments.length < 5) return null; // Reduced from 10 to 5
    
    const recentCommentCounts = [];
    const now = Date.now();
    
    // Group comments by 1-minute intervals (reduced from 2-minute)
    for (let i = 0; i < 4; i++) { // Reduced from 6 to 4 intervals
        const timeWindow = now - (i * 60000); // 1 minute instead of 2
        const count = metrics.recentComments.filter(c => 
            c.timestamp.getTime() > timeWindow - 60000 && 
            c.timestamp.getTime() <= timeWindow
        ).length;
        recentCommentCounts.unshift(count);
    }
    
    console.log(`🤖 [TREND] Comment counts by minute: ${recentCommentCounts.join(', ')}`);
    
    // Detect trend (simple linear regression)
    const trend = calculateTrend(recentCommentCounts);
    console.log(`🤖 [TREND] Calculated trend slope: ${trend}`);
    
    // More lenient thresholds for testing
    if (trend < -0.2 && recentCommentCounts[0] < 8) { // Reduced from -0.5 and 5
        return 'declining';
    } else if (trend > 0.3 && recentCommentCounts[0] > 12) { // Reduced from 0.5 and 15
        return 'increasing';
    }
    
    return 'stable';
}



// Intelligent sentiment analysis with actionable insights
function analyzeSentimentIntelligence() {
    if (metrics.commentSentiments.length < 20) return null;
    
    const recentSentiments = metrics.commentSentiments.slice(-20);
    const avgSentiment = recentSentiment.reduce((a, b) => a + b, 0) / recentSentiment.length;
    const sentimentVariance = calculateVariance(recentSentiments);
    
    // Detect specific sentiment patterns
    if (avgSentiment < -0.5 && sentimentVariance < 2) {
        const currentViewers = metrics.currentViewerCount || 0;
        
        if (currentViewers > 1000) {
            return {
                type: 'sentiment',
                priority: 'high',
                message: `😔 Large audience (${currentViewers}) but down mood (${avgSentiment.toFixed(2)}). Ask: "Smile maker?" or good news share. Retention: ${(metrics.predictiveMetrics.viewerRetentionRate * 100).toFixed(0)}%.`,
                trigger: 'large_audience_negative_mood',
                action: 'mood_transformation'
            };
        } else {
            return {
                type: 'sentiment',
                priority: 'high',
                message: `😔 Down chat (${avgSentiment.toFixed(2)}). Turn around: "Positive today?" Entertainment: ${metrics.entertainmentMetrics.entertainmentScore}; phase: ${metrics.streamPhase}.`,
                trigger: 'sustained_negative',
                action: 'positive_redirection'
            };
        }
    }
    
    if (avgSentiment > 1.5 && sentimentVariance > 3) {
        const currentViewers = metrics.currentViewerCount || 0;
        const likeRate = metrics.likesPerMinute || 0;
        
        if (currentViewers > 800 && likeRate > 40) {
            // Get top keyword for context
            const topKeywordEntry = Object.entries(metrics.keywordFrequency || {}).sort((a, b) => b[1] - a[1])[0];
            const topKeyword = topKeywordEntry ? topKeywordEntry[0] : 'general';
            
            return {
                type: 'sentiment',
                priority: 'high',
                message: `🎉 Great energy (${avgSentiment.toFixed(2)}), ${currentViewers} viewers, ${likeRate} likes/min! Ask: "Exciting ahead?" or game on "${topKeyword}". Grow follows!`,
                trigger: 'high_positive_energy_high_engagement',
                action: 'leverage_peak_momentum'
            };
        } else {
            return {
                type: 'sentiment',
                priority: 'medium',
                message: `🎉 Good vibes (${avgSentiment.toFixed(2)})! Capitalize: game ideas or win share. Volatility: ${sentimentVariance.toFixed(2)}; retention: ${(metrics.predictiveMetrics.viewerRetentionRate * 100).toFixed(0)}%.`,
                trigger: 'high_positive_energy',
                action: 'leverage_positive_mood'
            };
        }
    }
    
    // Detect sentiment swings (controversial topics)
    if (sentimentVariance > 5) {
        // Get top keyword and engager for context
        const topKeywordEntry = Object.entries(metrics.keywordFrequency || {}).sort((a, b) => b[1] - a[1])[0];
        const topKeyword = topKeywordEntry ? topKeywordEntry[0] : 'general';
        
        const topEngagerEntry = getViewerEngagementRanking()[0];
        const topEngager = topEngagerEntry ? topEngagerEntry.nickname : 'viewers';
        
        return {
            type: 'sentiment',
            priority: 'medium',
            message: `⚡ Divided chat (variance: ${sentimentVariance.toFixed(2)}). Ask: "Both sides thoughts?" on "${topKeyword}". Retention: ${(metrics.predictiveMetrics.viewerRetentionRate * 100).toFixed(0)}%; engage ${topEngager}.`,
            trigger: 'controversial_topic',
            action: 'facilitate_discussion'
        };
    }
    
    return null;
}

// Detect content opportunities based on chat patterns
function detectContentOpportunities() {
    // Analyze keyword patterns for content ideas
    const keywordInsights = analyzeKeywordInsights();
    if (keywordInsights) return keywordInsights;
    
    // Detect recurring themes
    const themeDetection = detectRecurringThemes();
    if (themeDetection) return themeDetection;
    
    // Identify viral moments
    const viralMoment = detectViralMoment();
    if (viralMoment) return viralMoment;
    
    return null;
}

// Smart keyword analysis (not just frequency)
function analyzeKeywordInsights() {
    if (!metrics.keywordFrequency || Object.keys(metrics.keywordFrequency).length === 0) {
        return null;
    }
    
    const keywordData = Object.entries(metrics.keywordFrequency)
        .map(([keyword, count]) => ({ keyword, count, context: getKeywordContext(keyword) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    
    // Look for meaningful patterns, not just common words
    const meaningfulKeywords = keywordData.filter(k => 
        k.count >= 3 && 
        k.keyword.length > 3 && 
        !isCommonWord(k.keyword) &&
        k.context !== 'generic'
    );
    
    if (meaningfulKeywords.length === 0) return null;
    
    const topKeyword = meaningfulKeywords[0];
    
    // Provide context-specific suggestions
    if (topKeyword.context === 'game') {
        return {
            type: 'content',
            priority: 'medium',
            message: `🎮 "${topKeyword.keyword}" hot (${topKeyword.count} mentions)! Ask: "Play next?" or tip share. Viewers: ${metrics.currentViewerCount}; phase: ${metrics.streamPhase}.`,
            trigger: 'game_trend',
            action: 'game_suggestion',
            keyword: topKeyword.keyword
        };
    }
    
    if (topKeyword.context === 'personal') {
        // Get top engager for context
        const topEngagerEntry = getViewerEngagementRanking()[0];
        const topEngager = topEngagerEntry ? topEngagerEntry.nickname : 'viewers';
        
        return {
            type: 'content',
            priority: 'medium',
            message: `👤 Curious on "${topKeyword.keyword}" (${topKeyword.count} mentions)! Share story or ask experience. Sentiment: ${metrics.rollingSentimentScore.toFixed(1)}; shoutout ${topEngager}.`,
            trigger: 'personal_interest',
            action: 'share_personal',
            keyword: topKeyword.keyword
        };
    }
    
    return {
        type: 'content',
        priority: 'medium',
        message: `💡 "${topKeyword.keyword}" attention (${topKeyword.count} mentions)! Discuss: "Thoughts on?" Avg watch: ${metrics.viewerStats.averageWatchTime}s; retention: ${(metrics.predictiveMetrics.viewerRetentionRate * 100).toFixed(0)}%.`,
            trigger: 'topic_interest',
            action: 'topic_discussion',
            keyword: topKeyword.keyword
        };
}

// Analyze viewer interaction patterns
function analyzeViewerInteractions() {
    // Detect new vs returning viewers
    const newViewers = detectNewViewers();
    if (newViewers) return newViewers;
    
    // Analyze like patterns
    const likePattern = analyzeLikePatterns();
    if (likePattern) return likePattern;
    
    // Check for viewer milestones
    const viewerMilestone = checkViewerMilestones();
    if (viewerMilestone) return viewerMilestone;
    
    return null;
}

// Monitor overall stream health
function monitorStreamHealth() {
    const now = Date.now();
    
    // Check for extended silence
    if (metrics.recentComments.length > 0) {
        const lastCommentTime = metrics.recentComments[0].timestamp.getTime();
        if (now - lastCommentTime > 300000) { // 5 minutes
            // Get top keyword for context
            const topKeywordEntry = Object.entries(metrics.keywordFrequency || {}).sort((a, b) => b[1] - a[1])[0];
            const topKeyword = topKeywordEntry ? topKeywordEntry[0] : 'general';
            
            return {
                type: 'health',
                priority: 'high',
                message: `🔇 Quiet chat (${((now - lastCommentTime)/60000).toFixed(1)} min). Ask: "Still here? Comment!" or next idea. Churn: ${metrics.predictiveMetrics.churnRiskScore}%; "${topKeyword}".`,
                trigger: 'extended_silence',
                action: 'reengage_chat'
            };
        }
    }
    
    // Check viewer retention
    if (metrics.currentViewerCount > 0 && metrics.viewerHistory) {
        const retentionRate = calculateRetentionRate();
        if (retentionRate < 0.7) {
            return {
                type: 'health',
                priority: 'medium',
                message: `📊 Low retention (${(retentionRate * 100).toFixed(0)}%). Tease: "Stay for [upcoming]!" or change up. Energy: ${metrics.entertainmentMetrics.audienceEnergy.toFixed(2)}; phase: ${metrics.streamPhase}.`,
                trigger: 'low_retention',
                action: 'improve_retention'
            };
        }
    }
    
    return null;
}

// Smart prompt selection with variety and cooldowns
function selectBestPrompt(prompts) {
    if (prompts.length === 0) return null;
    
    const now = Date.now(); // Define 'now' variable here
    
    // Sort by priority and recency
    const sortedPrompts = prompts.sort((a, b) => {
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    // Check cooldowns for specific trigger types
    const availablePrompts = sortedPrompts.filter(prompt => {
        const lastTriggered = metrics.promptCooldowns?.[prompt.trigger] || 0;
        const cooldown = getCooldownForTrigger(prompt.trigger);
        return (now - lastTriggered) > cooldown;
    });
    
    if (availablePrompts.length === 0) return null;
    
    // Rotate to avoid repetition: Prefer prompts not in recent history
    const recentTriggers = metrics.promptHistory.slice(-3); // Last 3 prompts
    let selectedPrompt = availablePrompts.find(p => !recentTriggers.includes(p.trigger)) || availablePrompts[0];
    
    // Update cooldown tracking
    if (!metrics.promptCooldowns) metrics.promptCooldowns = {};
    metrics.promptCooldowns[selectedPrompt.trigger] = now;
    metrics.lastPromptTime = now;
    
    // Update prompt history (keep last 10)
    metrics.promptHistory.push(selectedPrompt.trigger);
    if (metrics.promptHistory.length > 10) {
        metrics.promptHistory.shift();
    }
    
    return selectedPrompt;
}

// Helper function to get translated prompt
function getTranslatedPrompt(key, variables = {}) {
    const translations = promptTranslations[currentLanguage] || promptTranslations.en;
    let prompt = translations[key] || promptTranslations.en[key];
    
    // Replace variables in the prompt
    Object.entries(variables).forEach(([key, value]) => {
        prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
    });
    
    return prompt;
}

// Helper functions
function calculateTrend(values) {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((a, b, i) => a + (b * i), 0);
    const sumX2 = values.reduce((a, b, i) => a + (i * i), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
}

function calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return variance;
}

function getKeywordContext(keyword) {
    const gameKeywords = ['game', 'play', 'win', 'lose', 'battle', 'warzone', 'cod', 'fortnite', 'minecraft'];
    const personalKeywords = ['family', 'friend', 'work', 'school', 'home', 'city', 'country'];
    
    if (gameKeywords.some(k => keyword.toLowerCase().includes(k))) return 'game';
    if (personalKeywords.some(k => keyword.toLowerCase().includes(k))) return 'personal';
    
    return 'generic';
}

function isCommonWord(word) {
    const commonWords = ['the', 'and', 'you', 'that', 'this', 'with', 'for', 'are', 'but', 'not', 'they', 'have', 'from', 'one', 'had', 'word', 'what', 'said', 'each', 'which', 'she', 'do', 'how', 'their', 'if', 'will', 'up', 'other', 'about', 'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would', 'make', 'like', 'into', 'him', 'time', 'two', 'more', 'go', 'no', 'way', 'could', 'my', 'than', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'];
    return commonWords.includes(word.toLowerCase());
}

function getCooldownForTrigger(trigger) {
    const cooldowns = {
        'engagement_decline': 300000,      // 5 minutes
        'sustained_negative': 600000,      // 10 minutes
        'extended_silence': 300000,        // 5 minutes
        'game_trend': 240000,              // 4 minutes
        'personal_interest': 300000,       // 5 minutes
        'topic_interest': 240000,          // 4 minutes
        'high_positive_energy': 180000,    // 3 minutes
        'controversial_topic': 300000,     // 5 minutes
        'low_retention': 600000,           // 10 minutes
        'high_shares': 240000,             // 4 minutes
        'new_followers': 180000,           // 3 minutes
        'viral_moment': 120000,            // 2 minutes
        'default': 180000                  // 3 minutes
    };
    
    return cooldowns[trigger] || cooldowns.default;
}

// Additional helper functions for the AI system
function detectNewViewers() {
    // Enhanced: Simple detection based on recent joins vs total
    const recentJoins = Object.values(metrics.viewers).filter(v => (Date.now() - v.joinTime) < 300000).length; // Last 5 min
    if (recentJoins / metrics.viewerStats.totalUniqueViewers > 0.4) { // >40% new
        return {
            type: 'growth',
            priority: 'medium',
            message: `👋 Many new viewers (${recentJoins} recent joins). Welcome them: "New here? Share why you joined!" Phase: ${metrics.streamPhase}; follows: ${metrics.sessionFollowersGained}.`,
            trigger: 'new_viewers',
            action: 'welcome_new'
        };
    }
    return null;
}

function analyzeLikePatterns() {
    // Get top keyword for context
    const topKeyword = Object.keys(metrics.keywordFrequency).sort((a, b) => 
        metrics.keywordFrequency[b] - metrics.keywordFrequency[a]
    )[0] || 'general';
    
    // Get top engager for personalization
    const topEngager = Object.values(metrics.viewers)
        .filter(v => v.isActive && (v.totalLikes > 0 || v.totalGifts > 0 || v.totalComments > 0))
        .sort((a, b) => (b.totalLikes + b.totalGifts * 2 + b.totalComments) - (a.totalLikes + a.totalGifts * 2 + a.totalComments))[0]?.nickname || 'viewers';
    
    if (metrics.likesPerMinute < 5 && metrics.totalLikes > 100) {
        return {
            type: 'engagement',
            priority: 'medium',
            message: `❤️ Low likes (${metrics.likesPerMinute}/min). Encourage: "Like if enjoying!" or tie to "${topKeyword}". Viewers: ${metrics.currentViewerCount}.`,
            trigger: 'low_likes',
            action: 'encourage_likes'
        };
    }
    
    // Detect like spikes (viral moments)
    if (metrics.likesPerMinute > 50) {
        return {
            type: 'engagement',
            priority: 'medium',
            message: `🚀 Like spike (${metrics.likesPerMinute}/min)! Resonate: keep it; ask opinion from ${topEngager}. Grow: "Follow for more!"`,
            trigger: 'like_spike',
            action: 'maintain_momentum'
        };
    }
    
    return null;
}

function checkViewerMilestones() {
    if (metrics.currentViewerCount > 1000 && metrics.currentViewerCount % 500 === 0) {
        return {
            type: 'milestone',
            priority: 'medium',
            message: `🎉 Milestone: ${metrics.currentViewerCount} viewers! Celebrate: "What brought you?" Trend: ${metrics.predictiveMetrics.engagementTrend}; gains: ${metrics.sessionFollowersGained}.`,
            trigger: 'viewer_milestone',
            action: 'celebrate_milestone'
        };
    }
    
    return null;
}

function detectRecurringThemes() {
    // Enhanced: Detect if top keyword has high frequency
    const topKeywordEntry = Object.entries(metrics.keywordFrequency).sort((a, b) => b[1] - a[1])[0];
    if (topKeywordEntry && topKeywordEntry[1] > 10) {
        const [topKeyword, topFreq] = topKeywordEntry;
        return {
            type: 'theme',
            priority: 'medium',
            message: `🔄 Recurring theme "${topKeyword}" (${topFreq} mentions). Dive deeper: "More on this?" or poll. Retention: ${(metrics.predictiveMetrics.viewerRetentionRate * 100).toFixed(0)}%.`,
            trigger: 'recurring_theme',
            action: 'explore_theme'
        };
    }
    return null;
}

function detectViralMoment() {
    // Already integrated in generateAutomatedPrompt, but can expand if needed
    return null;
}

function calculateRetentionRate() {
    // This would require tracking viewer entry/exit times
    // For now, return a default value to avoid complexity
    return 0.8;
}

// Helper function to extract user information
function getUserInfo(data) {
    // Try multiple possible field names for user ID
    const userId = data.uniqueId || data.userId || data.user?.uniqueId || data.user?.userId || 
                   data.user?.id || data.id || 'Unknown';
    
    // Try multiple possible field names for nickname
    const nickname = data.nickname || data.user?.nickname || data.user?.displayName || 
                     data.displayName || data.user?.name || data.name || 
                     data.user?.username || data.username || 'Anonymous';
    
    return {
        userId: userId,
        nickname: nickname
    };
}

// Helper function to extract gift information
function getGiftInfo(data) {
    // Extract gift name with better fallback handling
    let giftName = 'Unknown Gift';
    if (data.giftName) giftName = data.giftName;
    else if (data.gift?.name) giftName = data.gift.name;
    else if (data.giftInfo?.name) giftName = data.giftInfo.name;
    
    // Extract gift ID
    let giftId = 'Unknown';
    if (data.giftId) giftId = data.giftId;
    else if (data.gift?.id) giftId = data.gift.id;
    else if (data.giftInfo?.id) giftId = data.giftInfo.id;
    
    // Extract gift type
    let giftType = 'Unknown';
    if (data.giftType) giftType = data.giftType;
    else if (data.gift?.type) giftType = data.gift.type;
    else if (data.giftInfo?.type) giftType = data.giftInfo.type;
    
    // Extract diamond count with better fallback handling
    let diamondCount = 'Unknown';
    if (data.diamondCount !== undefined && data.diamondCount !== null) {
        diamondCount = data.diamondCount;
    } else if (data.gift?.diamondCount !== undefined && data.gift?.diamondCount !== null) {
        diamondCount = data.gift.diamondCount;
    } else if (data.giftInfo?.diamondCount !== undefined && data.giftInfo?.diamondCount !== null) {
        diamondCount = data.giftInfo.diamondCount;
    } else if (data.coins !== undefined && data.coins !== null) {
        diamondCount = data.coins;
    }
    
   // Extract gift image
    let giftImage = 'No image';
    if (data.giftImage) giftImage = data.giftImage;
    else if (data.gift?.image) giftImage = data.gift.image;
    else if (data.giftInfo?.image) giftImage = data.giftInfo.image;
    
    // Extract repeat count
    let repeatCount = 1;
    if (data.repeatCount) repeatCount = data.repeatCount;
    else if (data.gift?.repeatCount) repeatCount = data.gift.repeatCount;
    else if (data.giftInfo?.repeatCount) repeatCount = data.giftInfo.repeatCount;
    
    return {
        name: giftName,
        id: giftId,
        type: giftType,
        diamondCount: diamondCount,
        image: giftImage,
        repeatCount: repeatCount
    };
}

// Update per-minute metrics (legacy - only when no sessions active)
function updatePerMinuteMetrics() {
    // Skip legacy metrics updates if there are active sessions
    if (userSessions.size > 0) {
        return;
    }
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old entries
    likesInLastMinute = likesInLastMinute.filter(time => time > oneMinuteAgo);
    giftsInLastMinute = giftsInLastMinute.filter(time => time > oneMinuteAgo);
    commentsInLastMinute = commentsInLastMinute.filter(time => time > oneMinuteAgo);
    sharesInLastMinute = sharesInLastMinute.filter(time => time > oneMinuteAgo);
    followersGainedInLastMinute = followersGainedInLastMinute.filter(time => time > oneMinuteAgo);
    
    // Update metrics
    metrics.likesPerMinute = likesInLastMinute.length;
    metrics.giftsPerMinute = giftsInLastMinute.length;
    
    // Calculate gifts per minute (diamonds and USD value)
    const recentGifts = metrics.recentGiftValues.filter(gift => gift.timestamp > oneMinuteAgo);
    metrics.giftsPerMinuteDiamonds = recentGifts.reduce((sum, gift) => sum + gift.diamonds, 0);
    metrics.giftsPerMinuteValue = recentGifts.reduce((sum, gift) => sum + gift.usdValue, 0);
    
    metrics.commentsPerMinute = commentsInLastMinute.length;
    metrics.sharesPerMinute = sharesInLastMinute.length;
    metrics.followersGainsPerMinute = followersGainedInLastMinute.length;
    metrics.lastUpdate = new Date();
    
    // Update entertainment level when engagement metrics change
    calculateEntertainmentLevel();
    
    // Broadcast updated metrics to all connected clients (only if no sessions active)
    if (userSessions.size === 0) {
    broadcastMetrics();
    }
}

// Broadcast metrics to all connected WebSocket clients (legacy - only when no sessions active)
function broadcastMetrics() {
    // Skip legacy broadcasting if there are active sessions
    console.log('📊 [BROADCAST] broadcastMetrics called - userSessions.size:', userSessions.size);
    if (userSessions.size > 0) {
        console.log('📊 [BROADCAST] Skipping legacy broadcast - active sessions detected:', userSessions.size);
        return;
    }
    
    // Create a clean metrics object for broadcasting
    const metricsData = {
        currentViewerCount: metrics.currentViewerCount,
        
        // Cumulative totals (all-time)
        totalLikes: metrics.totalLikes,
        totalGifts: metrics.totalGifts,
        totalGiftDiamonds: metrics.totalGiftDiamonds,
        totalGiftValue: metrics.totalGiftValue,
        totalComments: metrics.totalComments,
        totalShares: metrics.totalShares,
        
        // Current session totals
        sessionLikes: metrics.sessionLikes,
        sessionGifts: metrics.sessionGifts,
        sessionComments: metrics.sessionComments,
        sessionShares: metrics.sessionShares,
        
        // Stream session info
        streamStartTime: metrics.streamStartTime,
        isStreamActive: metrics.isStreamActive,
        
        likesPerMinute: metrics.likesPerMinute,
        giftsPerMinute: metrics.giftsPerMinute,
        giftsPerMinuteDiamonds: metrics.giftsPerMinuteDiamonds,
        giftsPerMinuteValue: metrics.giftsPerMinuteValue,
        commentsPerMinute: metrics.commentsPerMinute,
        sharesPerMinute: metrics.sharesPerMinute,
        followersGainsPerMinute: metrics.followersGainsPerMinute,
        sentimentScore: metrics.sentimentScore,
        rollingSentimentScore: metrics.rollingSentimentScore,
        keywordFrequency: metrics.keywordFrequency,
        userLikeCounts: metrics.userLikeCounts,
        // Add entertainment metrics
        entertainmentMetrics: {
            entertainmentScore: metrics.entertainmentMetrics.entertainmentScore,
            engagementIntensity: metrics.entertainmentMetrics.engagementIntensity,
            contentReception: metrics.entertainmentMetrics.contentReception,
            audienceEnergy: metrics.entertainmentMetrics.audienceEnergy,
            retentionQuality: metrics.entertainmentMetrics.retentionQuality
        },
        
        // Add question detection data
        questionDetection: {
            pendingQuestions: metrics.questionDetection.pendingQuestions.slice(-5), // Last 5 pending questions
            questionStats: metrics.questionDetection.questionStats
        },
        // Add predictive analytics data
        predictiveMetrics: {
            churnRiskScore: metrics.predictiveMetrics.churnRiskScore,
            monetizationOpportunityScore: metrics.predictiveMetrics.monetizationOpportunityScore,
            engagementTrend: metrics.predictiveMetrics.engagementTrend,
            viewerRetentionRate: metrics.predictiveMetrics.viewerRetentionRate,
            sentimentVolatility: metrics.predictiveMetrics.sentimentVolatility
        },
        
        // Add viewer stats with engagement ranking
        viewerStats: {
            totalUniqueViewers: metrics.viewerStats.totalUniqueViewers,
            averageWatchTime: metrics.viewerStats.averageWatchTime,
            longestWatchTime: metrics.viewerStats.longestWatchTime,
            viewersByWatchTime: metrics.viewerStats.viewersByWatchTime,
            activeViewers: Object.values(metrics.viewers).filter(v => v.isActive).length,
            engagementRanking: getViewerEngagementRanking()
        },
        
        // Add new followers
        newFollowers: metrics.newFollowers || [],
        
        // Add session followers gained
        sessionFollowersGained: metrics.sessionFollowersGained || 0,
        
        timestamp: new Date()
    };
        
        console.log('📊 [BROADCAST] Sending metrics with viewerStats:', {
            viewerCount: metricsData.viewerStats?.activeViewers,
            engagementRankingCount: metricsData.viewerStats?.engagementRanking?.length,
            newFollowersCount: metricsData.newFollowers?.length,
            sessionFollowersGained: metricsData.sessionFollowersGained
        });
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'metrics',
                    data: metricsData
                }));
            }
        });
}

// Broadcast events to all connected dashboard clients
// Global broadcast function for metrics (similar to b594427 approach)
function broadcastGlobalMetrics() {
    // Broadcast metrics for each session individually (b594427 approach)
    userSessions.forEach((session, sessionId) => {
        if (session.wsClients.size > 0) {
            // Ensure all fields are properly initialized
            ensureSessionMetricsFields(session);
            
            const sessionMetrics = {
                currentViewerCount: session.metrics.currentViewerCount,
                
                // Cumulative totals (all-time)
                totalLikes: session.metrics.totalLikes,
                totalGifts: session.metrics.totalGifts,
                totalGiftDiamonds: session.metrics.totalGiftDiamonds,
                totalGiftValue: session.metrics.totalGiftValue,
                totalComments: session.metrics.totalComments,
                totalShares: session.metrics.totalShares,
                
                // Per-minute metrics
                likesPerMinute: session.metrics.likesPerMinute,
                giftsPerMinute: session.metrics.giftsPerMinute,
                giftsPerMinuteDiamonds: session.metrics.giftsPerMinuteDiamonds,
                giftsPerMinuteValue: session.metrics.giftsPerMinuteValue,
                commentsPerMinute: session.metrics.commentsPerMinute,
                sharesPerMinute: session.metrics.sharesPerMinute,
                followersGainsPerMinute: session.metrics.followersGainsPerMinute,
                
                // Sentiment and engagement
                sentimentScore: session.metrics.sentimentScore,
                rollingSentimentScore: session.metrics.rollingSentimentScore,
                keywordFrequency: session.metrics.keywordFrequency,
                userLikeCounts: session.metrics.userLikeCounts,
                
                // Entertainment metrics
                entertainmentMetrics: session.metrics.entertainmentMetrics,
                
                // Question detection
                questionDetection: session.metrics.questionDetection,
                
                // Predictive metrics
                predictiveMetrics: session.metrics.predictiveMetrics,
                
                // Viewer stats with engagement ranking
                viewerStats: session.metrics.viewerStats,
                
                // Followers
                newFollowers: session.metrics.newFollowers || [],
                sessionFollowersGained: session.metrics.sessionFollowersGained || 0,
                
                // Session info
                sessionId: sessionId,
                username: session.username,
                timestamp: new Date()
            };
            
            // Broadcast to all connected clients with sessionId in the message
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    try {
                        client.send(JSON.stringify({
                            type: 'metrics',
                            sessionId: sessionId,
                            data: sessionMetrics
                        }));
                    } catch (error) {
                        console.error('Error broadcasting metrics to client:', error);
                    }
                }
            });
        }
    });
}

function broadcastEvent(type, data) {
    const message = JSON.stringify({ type, data });
    console.log(`📤 Broadcasting ${type}:`, data);
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error('❌ Error sending to dashboard:', error);
            }
        }
    });
}

// WebSocket connection handling moved to comprehensive handler below

// Memory management and optimization
const MAX_SENTIMENT_HISTORY = 100;
const MAX_KEYWORDS = 50;
const MAX_VIEWER_HISTORY = 100;
const MAX_PENDING_QUESTIONS = 20;

// Memory cleanup function
function cleanupMemory() {
    // Limit sentiment history
    if (metrics.commentSentiments.length > MAX_SENTIMENT_HISTORY) {
        metrics.commentSentiments = metrics.commentSentiments.slice(-MAX_SENTIMENT_HISTORY);
    }
    
    // Limit viewer history
    if (metrics.viewerHistory.length > MAX_VIEWER_HISTORY) {
        metrics.viewerHistory = metrics.viewerHistory.slice(-MAX_VIEWER_HISTORY);
    }
    
    // Limit pending questions
    if (metrics.questionDetection.pendingQuestions.length > MAX_PENDING_QUESTIONS) {
        metrics.questionDetection.pendingQuestions = metrics.questionDetection.pendingQuestions.slice(-MAX_PENDING_QUESTIONS);
    }
    
    // Clean up old viewer data (inactive for more than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    Object.keys(metrics.viewers).forEach(userId => {
        if (metrics.viewers[userId].lastSeen < oneHourAgo && !metrics.viewers[userId].isActive) {
            delete metrics.viewers[userId];
        }
    });
    
    console.log('🧹 [MEMORY] Cleanup completed');
}

// Cleanup expired connections from cache
function cleanupExpiredConnections() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, cachedConnection] of connectionCache.entries()) {
        if ((now - cachedConnection.timestamp) > CONNECTION_CACHE_DURATION) {
            try {
                if (cachedConnection.connection) {
                    cachedConnection.connection.disconnect();
                }
            } catch (error) {
                console.log('⚠️ [CACHE] Error disconnecting cached connection:', error.message);
            }
            connectionCache.delete(key);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 [CACHE] Cleaned up ${cleanedCount} expired connections`);
    }
}

// Run memory cleanup every 5 minutes
setInterval(cleanupMemory, 5 * 60 * 1000);

// Set up periodic cleanup of expired connections
setInterval(cleanupExpiredConnections, 2 * 60 * 1000); // Every 2 minutes

// Multi-user session management
const userSessions = new Map(); // sessionId -> { connection, metrics, username, wsClients }
let sessionCounter = 0;

// Session management functions
function generateSessionId() {
    return `session_${++sessionCounter}_${Date.now()}`;
}

function createUserSession(username, wsClient) {
    // Validate username
    if (!username || typeof username !== 'string') {
        throw new Error('Invalid username provided to createUserSession');
    }
    
    const sessionId = generateSessionId();
    const session = {
        id: sessionId,
        username: username.trim(),
        connection: null,
        isConnecting: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 5000,
        metrics: createEmptyMetrics(),
        wsClients: new Set([wsClient]),
        createdAt: Date.now(),
        lastActivity: Date.now()
    };
    
    userSessions.set(sessionId, session);
    console.log(`🆕 [SESSION] Created new session ${sessionId} for user @${username}`);
    return session;
}

function getSessionByClient(wsClient) {
    for (const [sessionId, session] of userSessions) {
        if (session.wsClients.has(wsClient)) {
            return session;
        }
    }
    return null;
}

function removeClientFromSession(wsClient) {
    for (const [sessionId, session] of userSessions) {
        if (session.wsClients.has(wsClient)) {
            session.wsClients.delete(wsClient);
            session.lastActivity = Date.now();
            
            // If no clients left, clean up session after delay
            if (session.wsClients.size === 0) {
                console.log(`🧹 [SESSION] No clients left for session ${sessionId}, scheduling cleanup`);
                setTimeout(() => {
                    if (userSessions.has(sessionId) && userSessions.get(sessionId).wsClients.size === 0) {
                        cleanupSession(sessionId);
                    }
                }, 30000); // 30 second delay before cleanup
            }
            return session;
        }
    }
    return null;
}

function cleanupSession(sessionId) {
    const session = userSessions.get(sessionId);
    if (session) {
        console.log(`🧹 [SESSION] Cleaning up session ${sessionId} for @${session.username}`);
        
        // Disconnect TikTok connection
        if (session.connection) {
            try {
                session.connection.disconnect();
            } catch (error) {
                console.log('⚠️ [SESSION] Error disconnecting during cleanup:', error.message);
            }
        }
        
        userSessions.delete(sessionId);
    }
}

function createEmptyMetrics() {
    return {
        currentViewerCount: 0,
        totalLikes: 0,
        totalGifts: 0,
        totalGiftDiamonds: 0,
        totalGiftValue: 0,
        totalComments: 0,
        totalShares: 0,
        likesPerMinute: 0,
        giftsPerMinute: 0,
        giftsPerMinuteDiamonds: 0,
        giftsPerMinuteValue: 0,
        commentsPerMinute: 0,
        sharesPerMinute: 0,
        followersGainsPerMinute: 0,
        sentimentScore: 0,
        rollingSentimentScore: 0,
        sentimentHistory: [],
        keywordFrequency: {},
        userLikeCounts: {},
        viewers: {},
        viewerStats: {
            totalUniqueViewers: 0,
            averageWatchTime: 0,
            longestWatchTime: 0,
            viewersByWatchTime: {
                '0-5min': 0,
                '5-15min': 0,
                '15-30min': 0,
                '30min+': 0
            },
            activeViewers: 0,
            engagementRanking: []
        },
        newFollowers: [],
        sessionFollowersGained: 0,
        entertainmentMetrics: {
            entertainmentScore: 0,
            engagementIntensity: 0,
            contentReception: 0,
            audienceEnergy: 0,
            retentionQuality: 0
        },
        questionDetection: {
            pendingQuestions: [],
            answeredQuestions: [],
            questionStats: {
                totalQuestions: 0,
                answeredQuestions: 0,
                unansweredQuestions: 0,
                averageResponseTime: 0
            }
        },
        predictiveMetrics: {
            churnRiskScore: 0,
            monetizationOpportunityScore: 0,
            engagementTrend: 'stable',
            viewerRetentionRate: 0,
            sentimentVolatility: 0,
            peakEngagementTime: null,
            recommendedActions: []
        },
        sessionStartTime: Date.now(),
        lastActivity: Date.now(),
        // Per-minute tracking arrays
        likesInLastMinute: [],
        giftsInLastMinute: [],
        commentsInLastMinute: [],
        sharesInLastMinute: [],
        followersGainedInLastMinute: []
    };
}

// Legacy variables for backward compatibility (will be removed)
let connection = null;
let isConnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 5000; // 5 seconds

// Rate limiting and retry management
const connectionAttempts = new Map(); // Track connection attempts per session
const connectionCache = new Map(); // Cache connections to reuse them
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY = 30000; // 30 seconds base delay
const CONNECTION_CACHE_DURATION = 300000; // 5 minutes cache duration

// Session-aware connection management with rate limiting bypass
async function connectToTikTokForSession(session, retryAttempt = 0) {
    if (session.isConnecting) return;
    
    // Check if username is set
    if (!session.username || session.username.trim() === '') {
        console.log('⚠️ [SESSION] No username set for session', session.id);
        return;
    }
    
    // Check if we've exceeded retry attempts
    if (retryAttempt >= MAX_RETRY_ATTEMPTS) {
        console.error(`❌ [SESSION ${session.id}] Max retry attempts reached for ${session.username}`);
        return;
    }
    
    session.isConnecting = true;
    console.log(`🔗 [SESSION ${session.id}] Attempting to connect to TikTok Live: ${session.username} (Attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
    
    try {
        // Check if we have a cached connection for this username
        const cacheKey = session.username;
        const cachedConnection = connectionCache.get(cacheKey);
        const now = Date.now();
        
        if (cachedConnection && (now - cachedConnection.timestamp) < CONNECTION_CACHE_DURATION) {
            console.log(`♻️ [SESSION ${session.id}] Reusing cached connection for ${session.username}`);
            session.connection = cachedConnection.connection;
        } else {
            // Add random delay to avoid rate limiting (0-5 seconds)
            const randomDelay = Math.random() * 5000;
            if (randomDelay > 0) {
                console.log(`⏳ [SESSION ${session.id}] Adding random delay: ${randomDelay.toFixed(0)}ms`);
                await new Promise(resolve => setTimeout(resolve, randomDelay));
            }
            
            session.connection = new WebcastPushConnection(session.username, {
            requestPollingIntervalMs: 3000 + Math.random() * 2000, // Randomize polling interval
            sessionId: undefined,
            clientParams: {
                "app_language": "en-US",
                "device_platform": "web",
                "webcast_sdk_version": "1.3.0",
                "web_id": "7280301053461791239",
                "msToken": "msToken",
                "browser_language": "en",
                "browser_platform": "Win32",
                "browser_name": "Mozilla",
                "browser_version": "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "browser_online": true,
                "tz_name": "America/New_York",
                "identity": "en",
                "room_id": "7280301053461791239",
                "heartbeatIntervalMs": 15000,
                "client": "web"
            },
            connectTimeoutMs: 30000,
            requestTimeoutMs: 10000
        });

        // Set up event handlers for this session
        setupSessionEventHandlers(session);
        
        // Connect to the live stream
        await session.connection.connect();
        
            // Cache the connection for reuse
            connectionCache.set(cacheKey, {
                connection: session.connection,
                timestamp: now
            });
            console.log(`💾 [SESSION ${session.id}] Cached connection for ${session.username}`);
        }
        
    } catch (error) {
        console.error(`❌ [SESSION ${session.id}] Failed to connect:`, error);
        session.isConnecting = false;
        throw error;
    }
}

function setupSessionEventHandlers(session) {
    const connection = session.connection;
    
    connection.on('connected', (state) => {
        console.log(`✅ [SESSION ${session.id}] Connected to TikTok Live!`);
        console.log(`📊 [SESSION ${session.id}] Room info:`, state);
        session.isConnecting = false;
        session.reconnectAttempts = 0;
        
        // Reset session metrics for new stream
        session.metrics = createEmptyMetrics();
        
        // Extract initial room state
        extractInitialRoomStateForSession(state, session);
        
        // Broadcast connection status to session clients
        broadcastToSession(session, 'connected', { 
            status: 'connected', 
            roomInfo: state,
            sessionId: session.id,
            username: session.username
        });
    });

    connection.on('disconnected', (reason) => {
        console.log(`❌ [SESSION ${session.id}] Disconnected from TikTok Live:`, reason);
        session.isConnecting = false;
        
        // Broadcast disconnection status to session clients
        broadcastToSession(session, 'disconnected', { 
            status: 'disconnected', 
            reason,
            sessionId: session.id,
            username: session.username
        });
        
        // Attempt reconnection if not max attempts
        if (session.reconnectAttempts < session.maxReconnectAttempts) {
            session.reconnectAttempts++;
            console.log(`🔄 [SESSION ${session.id}] Reconnection attempt ${session.reconnectAttempts}/${session.maxReconnectAttempts} in ${session.reconnectDelay/1000}s...`);
            setTimeout(() => {
                if (!session.isConnecting) {
                    connectToTikTokForSession(session);
                }
            }, session.reconnectDelay);
        } else {
            console.error(`❌ [SESSION ${session.id}] Max reconnection attempts reached.`);
        }
    });

    // Add all other event handlers here (chat, like, gift, etc.)
    // These will be similar to the existing handlers but will use session-specific metrics
    connection.on('chat', (data) => {
        console.log(`💬 [SESSION ${session.id}] Chat event received:`, data);
        handleChatEventForSession(data, session);
    });

    connection.on('like', (data) => {
        console.log(`❤️ [SESSION ${session.id}] Like event received:`, data);
        handleLikeEventForSession(data, session);
    });

    connection.on('gift', (data) => {
        console.log(`🎁 [SESSION ${session.id}] Gift event received:`, data);
        handleGiftEventForSession(data, session);
    });

    connection.on('follow', (data) => {
        console.log(`🆕 [SESSION ${session.id}] Follow event received:`, data);
        handleFollowEventForSession(data, session);
    });

    connection.on('roomUser', (data) => {
        console.log(`👥 [SESSION ${session.id}] Room user event:`, data);
        handleRoomUserEventForSession(data, session);
    });

    // Add catch-all event handler to see what other events are available
    connection.on('*', (eventName, data) => {
        console.log(`🔍 [SESSION ${session.id}] Received event: ${eventName}`, data);
    });

    // Add error handling with retry logic
    connection.on('error', (error) => {
        console.error(`❌ [SESSION ${session.id}] Connection error:`, error);
        session.isConnecting = false;
        
        // Check if it's a rate limiting error
        if (error.message && (error.message.includes('Rate Limited') || error.message.includes('rate_limit'))) {
            console.log(`⏳ [SESSION ${session.id}] Rate limit detected, implementing exponential backoff...`);
            
            // Calculate exponential backoff delay
            const backoffDelay = BASE_RETRY_DELAY * Math.pow(2, retryAttempt);
            const jitter = Math.random() * 10000; // Add up to 10 seconds of jitter
            const totalDelay = backoffDelay + jitter;
            
            console.log(`⏳ [SESSION ${session.id}] Retrying in ${Math.round(totalDelay/1000)}s (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
            
            // Schedule retry with exponential backoff
            setTimeout(async () => {
                if (!session.isConnecting) {
                    await connectToTikTokForSession(session, retryAttempt + 1);
                }
            }, totalDelay);
            
            // Notify frontend about rate limiting
            broadcastToSession(session, 'rateLimited', {
                message: `Rate limited. Retrying in ${Math.round(totalDelay/1000)} seconds...`,
                retryAttempt: retryAttempt + 1,
                maxAttempts: MAX_RETRY_ATTEMPTS,
                delay: totalDelay
            });
        } else {
            // For other errors, use standard retry logic
            if (retryAttempt < MAX_RETRY_ATTEMPTS) {
                const retryDelay = 5000 + (retryAttempt * 2000); // 5s, 7s, 9s, 11s, 13s
                console.log(`🔄 [SESSION ${session.id}] Retrying connection in ${retryDelay/1000}s...`);
                
                setTimeout(async () => {
                    if (!session.isConnecting) {
                        await connectToTikTokForSession(session, retryAttempt + 1);
                    }
                }, retryDelay);
            } else {
                console.error(`❌ [SESSION ${session.id}] Max retry attempts reached for connection error`);
            }
        }
        
        // Broadcast error to frontend
        broadcastToSession(session, 'connectionError', {
            error: error.message,
            retryAttempt: retryAttempt + 1,
            maxAttempts: MAX_RETRY_ATTEMPTS
        });
    });
}

function broadcastToSession(session, type, data) {
    const message = JSON.stringify({ type, data, sessionId: session.id });
    console.log(`📤 [SESSION ${session.id}] Broadcasting ${type}:`, data);
    
    session.wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error(`❌ [SESSION ${session.id}] Error sending to client:`, error);
            }
        }
    });
}

// Detect questions in chat comments for a specific session
function detectQuestionsForSession(comment, userId, nickname, session) {
    const questionPatterns = [
        // Direct questions
        /\?$/, // Ends with question mark
        /^(what|how|why|when|where|who|which|can|could|would|will|do|does|did|is|are|was|were|have|has|had)\b/i, // Question words
        /^(are you|do you|can you|would you|will you|have you|did you)\b/i, // Question phrases
        /^(tell me|explain|show me|help me)\b/i, // Request phrases
        /^(i wonder|i'm curious|i want to know)\b/i, // Curiosity phrases
    ];
    
    // Check if comment matches any question pattern
    const isQuestion = questionPatterns.some(pattern => pattern.test(comment.trim()));
    
    if (isQuestion) {
        const questionData = {
            id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: userId,
            nickname: nickname,
            question: comment.trim(),
            timestamp: new Date(),
            status: 'pending',
            priority: calculateQuestionPriority(comment),
            category: categorizeQuestion(comment)
        };
        
        // Add to session's pending questions
        session.metrics.questionDetection.pendingQuestions.push(questionData);
        
        // Keep only last 20 pending questions
        if (session.metrics.questionDetection.pendingQuestions.length > 20) {
            session.metrics.questionDetection.pendingQuestions = session.metrics.questionDetection.pendingQuestions.slice(-20);
        }
        
        // Update session question stats
        updateSessionQuestionStats(session);
        
        console.log(`❓ [SESSION ${session.id}] Question detected: "${comment}" from ${nickname}`);
        return questionData;
    }
    
    return null;
}

// Update question statistics for a specific session
function updateSessionQuestionStats(session) {
    // Defensive programming - ensure questionDetection structure exists
    if (!session.metrics.questionDetection) {
        session.metrics.questionDetection = {
            pendingQuestions: [],
            answeredQuestions: [],
            questionStats: {
                totalQuestions: 0,
                answeredQuestions: 0,
                unansweredQuestions: 0,
                averageResponseTime: 0
            }
        };
    }
    
    // Ensure arrays exist
    if (!session.metrics.questionDetection.pendingQuestions) {
        session.metrics.questionDetection.pendingQuestions = [];
    }
    if (!session.metrics.questionDetection.answeredQuestions) {
        session.metrics.questionDetection.answeredQuestions = [];
    }
    if (!session.metrics.questionDetection.questionStats) {
        session.metrics.questionDetection.questionStats = {
            totalQuestions: 0,
            answeredQuestions: 0,
            unansweredQuestions: 0,
            averageResponseTime: 0
        };
    }
    
    const stats = session.metrics.questionDetection.questionStats;
    const pending = session.metrics.questionDetection.pendingQuestions.length;
    const answered = session.metrics.questionDetection.answeredQuestions.length;
    
    stats.totalQuestions = pending + answered;
    stats.answeredQuestions = answered;
    stats.unansweredQuestions = pending;
    stats.responseRate = stats.totalQuestions > 0 ? (answered / stats.totalQuestions) * 100 : 0;
    
    // Calculate average response time
    if (answered > 0) {
        const totalResponseTime = session.metrics.questionDetection.answeredQuestions.reduce((sum, q) => sum + (q.responseTime || 0), 0);
        stats.averageResponseTime = totalResponseTime / answered;
    }
    
    session.metrics.questionDetection.lastQuestionUpdate = new Date();
}

// Calculate question priority for session
function calculateQuestionPriority(comment) {
    let priority = 1; // Default priority
    
    // High priority indicators
    if (comment.includes('urgent') || comment.includes('help') || comment.includes('emergency')) {
        priority = 5;
    } else if (comment.includes('how to') || comment.includes('tutorial') || comment.includes('guide')) {
        priority = 4;
    } else if (comment.includes('what') || comment.includes('why') || comment.includes('when')) {
        priority = 3;
    } else if (comment.includes('?') && comment.length > 20) {
        priority = 2;
    }
    
    return Math.min(priority, 5); // Max priority 5
}

// Categorize question for session
function categorizeQuestion(comment) {
    const lowerComment = comment.toLowerCase();
    
    if (lowerComment.includes('how to') || lowerComment.includes('tutorial')) {
        return 'tutorial';
    } else if (lowerComment.includes('what') || lowerComment.includes('explain')) {
        return 'information';
    } else if (lowerComment.includes('when') || lowerComment.includes('time')) {
        return 'schedule';
    } else if (lowerComment.includes('where') || lowerComment.includes('location')) {
        return 'location';
    } else if (lowerComment.includes('why') || lowerComment.includes('reason')) {
        return 'explanation';
    } else {
        return 'general';
    }
}

// Track viewer for a specific session
function trackViewerForSession(userId, nickname, profilePic, session) {
    if (!userId || !nickname) return;
    
    const now = new Date();
    
    // Check if we're processing this user too quickly (within 1 second)
    if (session.metrics.viewers[userId] && session.metrics.viewers[userId].lastSeen) {
        const timeSinceLastSeen = now - session.metrics.viewers[userId].lastSeen;
        if (timeSinceLastSeen < 1000) { // Less than 1 second
            console.log(`⏱️ [SESSION ${session.id}] Skipping rapid re-add for ${nickname} (${userId}) - last seen ${timeSinceLastSeen}ms ago`);
            return;
        }
    }
    
    if (!session.metrics.viewers[userId]) {
        session.metrics.viewers[userId] = {
            userId: userId,
            nickname: nickname,
            profilePic: profilePic,
            joinTime: now,
            lastSeen: now,
            isActive: true,
            watchTime: 0,
            totalLikes: 0,
            totalGifts: 0,
            totalComments: 0,
            totalShares: 0,
            totalDiamonds: 0,
            totalGiftValue: 0,
            isFollower: false,
            followTime: null,
            hasBeenWelcomed: false,
            welcomeTimestamp: null
        };
        session.metrics.viewerStats.totalUniqueViewers++;
        console.log(`👤 [SESSION ${session.id}] New viewer joined: ${nickname} (${userId})`);
    } else {
        // Viewer rejoined, update last seen
        session.metrics.viewers[userId].lastSeen = now;
        session.metrics.viewers[userId].isActive = true;
        console.log(`👤 [SESSION ${session.id}] Viewer rejoined: ${nickname} (${userId})`);
    }
    
    // Update viewer stats for session
    updateSessionViewerStats(session);
}

// Update viewer activity for a specific session
function updateSessionViewerActivity(userId, activityType, session) {
    if (!session.metrics.viewers[userId]) return;
    
    const now = new Date();
    session.metrics.viewers[userId].lastSeen = now;
    
    // Update activity-specific counters
    switch (activityType) {
        case 'like':
            session.metrics.viewers[userId].totalLikes++;
            break;
        case 'gift':
            session.metrics.viewers[userId].totalGifts++;
            break;
        case 'comment':
            session.metrics.viewers[userId].totalComments++;
            break;
        case 'follow':
            session.metrics.viewers[userId].isFollower = true;
            session.metrics.viewers[userId].followTime = now;
            break;
        case 'share':
            session.metrics.viewers[userId].totalShares++;
            break;
    }
    
    console.log(`👤 [SESSION ${session.id}] Updated ${activityType} for ${session.metrics.viewers[userId].nickname}: ${activityType}s=${session.metrics.viewers[userId][`total${activityType.charAt(0).toUpperCase() + activityType.slice(1)}s`] || session.metrics.viewers[userId].isFollower}`);
}

// Update viewer stats for a specific session
function updateSessionViewerStats(session) {
    // Ensure viewers object exists
    if (!session.metrics.viewers) {
        session.metrics.viewers = {};
    }
    
    const allViewers = Object.values(session.metrics.viewers);
    const activeViewers = allViewers.filter(v => v.isActive);
    
    // Update total unique viewers count
    session.metrics.viewerStats.totalUniqueViewers = allViewers.length;
    
    if (allViewers.length > 0) {
        // Calculate average watch time (in seconds)
        const totalWatchTime = allViewers.reduce((sum, v) => sum + (v.watchTime || 0), 0);
        session.metrics.viewerStats.averageWatchTime = Math.floor(totalWatchTime / allViewers.length);
        
        // Find longest watch time (in seconds)
        session.metrics.viewerStats.longestWatchTime = Math.max(...allViewers.map(v => v.watchTime || 0));
        
        // Categorize viewers by watch time
        session.metrics.viewerStats.viewersByWatchTime = {
            '0-5min': allViewers.filter(v => (v.watchTime || 0) < 300).length,
            '5-15min': allViewers.filter(v => (v.watchTime || 0) >= 300 && (v.watchTime || 0) < 900).length,
            '15-30min': allViewers.filter(v => (v.watchTime || 0) >= 900 && (v.watchTime || 0) < 1800).length,
            '30min+': allViewers.filter(v => (v.watchTime || 0) >= 1800).length
        };
        
        session.metrics.viewerStats.activeViewers = activeViewers.length;
    } else {
        session.metrics.viewerStats.averageWatchTime = 0;
        session.metrics.viewerStats.longestWatchTime = 0;
        session.metrics.viewerStats.viewersByWatchTime = {
            '0-5min': 0,
            '5-15min': 0,
            '15-30min': 0,
            '30min+': 0
        };
        session.metrics.viewerStats.activeViewers = 0;
    }
}

// Update viewer watch times for a specific session
function updateSessionViewerWatchTimes(session) {
    if (!session.metrics.viewers) {
        session.metrics.viewers = {};
        return;
    }
    
    const now = Date.now();
    const sessionStartTime = session.metrics.sessionStartTime || now;
    
    Object.values(session.metrics.viewers).forEach(viewer => {
        if (viewer.isActive) {
            // Calculate watch time based on join time
            const watchTimeMs = now - (viewer.joinTime || sessionStartTime);
            viewer.watchTime = Math.floor(watchTimeMs / 1000); // Convert to seconds
            viewer.lastSeen = now;
        }
    });
}

// Ensure session metrics have all required fields (for existing sessions)
function ensureSessionMetricsFields(session) {
    // Ensure all required fields exist with proper defaults
    if (session.metrics.totalGiftDiamonds === undefined) session.metrics.totalGiftDiamonds = 0;
    if (session.metrics.totalGiftValue === undefined) session.metrics.totalGiftValue = 0;
    if (session.metrics.totalShares === undefined) session.metrics.totalShares = 0;
    if (session.metrics.sharesPerMinute === undefined) session.metrics.sharesPerMinute = 0;
    if (session.metrics.followersGainsPerMinute === undefined) session.metrics.followersGainsPerMinute = 0;
    if (session.metrics.giftsPerMinuteDiamonds === undefined) session.metrics.giftsPerMinuteDiamonds = 0;
    if (session.metrics.giftsPerMinuteValue === undefined) session.metrics.giftsPerMinuteValue = 0;
    
    // Ensure per-minute tracking arrays exist
    if (!session.metrics.likesInLastMinute) session.metrics.likesInLastMinute = [];
    if (!session.metrics.giftsInLastMinute) session.metrics.giftsInLastMinute = [];
    if (!session.metrics.commentsInLastMinute) session.metrics.commentsInLastMinute = [];
    if (!session.metrics.sharesInLastMinute) session.metrics.sharesInLastMinute = [];
    if (!session.metrics.followersGainedInLastMinute) session.metrics.followersGainedInLastMinute = [];
    
    // Ensure viewer stats structure is complete
    if (!session.metrics.viewerStats) session.metrics.viewerStats = {};
    if (!session.metrics.viewerStats.viewersByWatchTime) {
        session.metrics.viewerStats.viewersByWatchTime = {
            '0-5min': 0,
            '5-15min': 0,
            '15-30min': 0,
            '30min+': 0
        };
    }
    if (session.metrics.viewerStats.activeViewers === undefined) session.metrics.viewerStats.activeViewers = 0;
    if (!session.metrics.viewerStats.engagementRanking) session.metrics.viewerStats.engagementRanking = [];
    
    // Ensure entertainment metrics exist
    if (!session.metrics.entertainmentMetrics) {
        session.metrics.entertainmentMetrics = {
            entertainmentScore: 0,
            engagementIntensity: 0,
            contentReception: 0,
            audienceEnergy: 0,
            retentionQuality: 0
        };
    }
    
    // Ensure question detection exists
    if (!session.metrics.questionDetection) {
        session.metrics.questionDetection = {
            pendingQuestions: [],
            answeredQuestions: [],
            questionStats: {
                totalQuestions: 0,
                answeredQuestions: 0,
                unansweredQuestions: 0,
                averageResponseTime: 0
            }
        };
    }
    
    // Ensure predictive metrics exist
    if (!session.metrics.predictiveMetrics) {
        session.metrics.predictiveMetrics = {
            churnRiskScore: 0,
            monetizationOpportunityScore: 0,
            engagementTrend: 'stable',
            viewerRetentionRate: 0,
            sentimentVolatility: 0,
            peakEngagementTime: null,
            recommendedActions: []
        };
    }
}

// Update per-minute metrics for a specific session
function updateSessionPerMinuteMetrics(session) {
    // Ensure all required fields exist first
    ensureSessionMetricsFields(session);
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Filter arrays to only include events from the last minute
    session.metrics.likesInLastMinute = session.metrics.likesInLastMinute.filter(timestamp => timestamp > oneMinuteAgo);
    session.metrics.giftsInLastMinute = session.metrics.giftsInLastMinute.filter(timestamp => timestamp > oneMinuteAgo);
    session.metrics.commentsInLastMinute = session.metrics.commentsInLastMinute.filter(timestamp => timestamp > oneMinuteAgo);
    session.metrics.sharesInLastMinute = session.metrics.sharesInLastMinute.filter(timestamp => timestamp > oneMinuteAgo);
    session.metrics.followersGainedInLastMinute = session.metrics.followersGainedInLastMinute.filter(timestamp => timestamp > oneMinuteAgo);
    
    // Update per-minute counts
    session.metrics.likesPerMinute = session.metrics.likesInLastMinute.length;
    session.metrics.giftsPerMinute = session.metrics.giftsInLastMinute.length;
    session.metrics.commentsPerMinute = session.metrics.commentsInLastMinute.length;
    session.metrics.sharesPerMinute = session.metrics.sharesInLastMinute.length;
    session.metrics.followersGainsPerMinute = session.metrics.followersGainedInLastMinute.length;
    
    // Calculate gift value per minute (simplified - would need more complex tracking for accurate value)
    session.metrics.giftsPerMinuteDiamonds = session.metrics.giftsPerMinute * 10; // Rough estimate
    session.metrics.giftsPerMinuteValue = session.metrics.giftsPerMinute * 10; // Rough estimate
    
    session.metrics.lastUpdate = new Date();
}

// Generate engagement ranking for a specific session
function generateSessionEngagementRanking(session) {
    const viewers = Object.values(session.metrics.viewers || {});
    
    if (viewers.length === 0) {
        session.metrics.viewerStats.engagementRanking = [];
        return;
    }
    
    console.log(`🏆 [SESSION ${session.id}] Calculating engagement ranking for ${viewers.length} viewers`);
    
    // Calculate engagement score for each viewer using the same system as global
    const engagementData = viewers.map(viewer => {
        // Use the same scoring system as getViewerEngagementRanking
        const likesScore = (viewer.totalLikes || 0) * 8;
        const giftsScore = (viewer.totalGifts || 0) * 50;
        const commentsScore = (viewer.totalComments || 0) * 15;
        const sharesScore = (viewer.totalShares || 0) * 20;
        const diamondsScore = (viewer.totalDiamonds || 0) * 1;
        const watchTimeScore = (viewer.watchTime || 0) * 0.0001;
        
        // Calculate total engagement score
        const engagementScore = likesScore + giftsScore + commentsScore + sharesScore + diamondsScore + watchTimeScore;
        
        // Calculate engagement multiplier based on activity diversity
        let engagementMultiplier = 1.0;
        const hasLikes = (viewer.totalLikes || 0) > 0;
        const hasGifts = (viewer.totalGifts || 0) > 0;
        const hasComments = (viewer.totalComments || 0) > 0;
        const hasShares = (viewer.totalShares || 0) > 0;
        
        // Bonus for multiple types of engagement
        const engagementTypes = [hasLikes, hasGifts, hasComments, hasShares].filter(Boolean).length;
        if (engagementTypes >= 3) engagementMultiplier = 1.5;
        else if (engagementTypes >= 2) engagementMultiplier = 1.25;
        
        const finalScore = engagementScore * engagementMultiplier;
        
        return {
            nickname: viewer.nickname,
            userId: viewer.userId,
            engagementScore: finalScore,
            totalLikes: viewer.totalLikes || 0,
            totalComments: viewer.totalComments || 0,
            totalGifts: viewer.totalGifts || 0,
            totalShares: viewer.totalShares || 0,
            totalDiamonds: viewer.totalDiamonds || 0,
            watchTime: viewer.watchTime || 0,
            isActive: viewer.isActive || false,
            isFollower: viewer.isFollower || false,
            followTime: viewer.followTime
        };
    });
    
    // Sort by engagement score (highest first)
    engagementData.sort((a, b) => b.engagementScore - a.engagementScore);
    
    // Take top 10 most engaged viewers
    session.metrics.viewerStats.engagementRanking = engagementData.slice(0, 10);
    
    console.log(`🏆 [SESSION ${session.id}] Top 5 engagement scores:`, engagementData.slice(0, 5).map(v => `${v.nickname}: ${v.engagementScore.toFixed(1)}`));
}

// Calculate viewer retention rate for a specific session
function calculateSessionViewerRetention(session) {
    const currentViewers = session.metrics.currentViewerCount || 0;
    const totalUniqueViewers = session.metrics.viewerStats.totalUniqueViewers || 0;
    
    if (totalUniqueViewers === 0) {
        return 0;
    }
    
    // Calculate retention rate (current viewers / total unique viewers)
    const retentionRate = currentViewers / totalUniqueViewers;
    
    // Cap at 100% to avoid unrealistic percentages
    const cappedRate = Math.min(retentionRate, 1.0);
    
    console.log(`📊 [SESSION ${session.id}] Retention calculation: currentViewers=${currentViewers}, totalUniqueViewers=${totalUniqueViewers}, rate=${(cappedRate * 100).toFixed(1)}%`);
    
    return cappedRate;
}

// Calculate entertainment metrics for a specific session
function calculateSessionEntertainmentMetrics(session) {
    // Ensure metrics exist
    ensureSessionMetricsFields(session);
    
    const currentViewers = Math.max(session.metrics.currentViewerCount || 1, 1);
    const totalLikes = session.metrics.totalLikes || 0;
    const totalComments = session.metrics.totalComments || 0;
    const totalGifts = session.metrics.totalGifts || 0;
    const totalGiftDiamonds = session.metrics.totalGiftDiamonds || 0;
    
    // Calculate engagement intensity based on session metrics
    const likesPerViewer = totalLikes / currentViewers;
    const commentsPerViewer = totalComments / currentViewers;
    const giftsPerViewer = totalGifts / currentViewers;
    
    // More comprehensive engagement calculation
    const engagementIntensity = Math.min((likesPerViewer + commentsPerViewer + giftsPerViewer) / 5, 1);
    
    // Calculate content reception based on sentiment (improved calculation)
    let contentReception = 0.5; // Default neutral
    if (session.metrics.rollingSentimentScore !== undefined && session.metrics.rollingSentimentScore !== 0) {
        // Convert sentiment score (-1 to 1) to 0-1 scale, then to 0-1 for content reception
        contentReception = Math.max(0, Math.min(1, (session.metrics.rollingSentimentScore + 1) / 2));
    } else if (session.metrics.sentimentScore !== undefined && session.metrics.sentimentScore !== 0) {
        // Fallback to current sentiment score
        contentReception = Math.max(0, Math.min(1, (session.metrics.sentimentScore + 1) / 2));
    }
    
    // Calculate audience energy based on activity (improved formula)
    const totalActivity = totalLikes + totalComments + totalGifts;
    const activityScore = totalActivity / currentViewers;
    const audienceEnergy = Math.min(activityScore / 10, 1); // More sensitive to activity
    
    // Calculate retention quality based on viewer count and engagement
    const baseRetention = Math.min(currentViewers / 30, 1); // Lower threshold for better scoring
    const engagementBonus = Math.min(totalActivity / (currentViewers * 5), 0.3); // Bonus for high engagement
    const retentionQuality = Math.min(baseRetention + engagementBonus, 1);
    
    // Calculate final entertainment score (0-100) with improved weighting
    const entertainmentScore = Math.round(
        engagementIntensity * 35 +      // Increased weight for engagement
        contentReception * 25 +         // Content reception
        audienceEnergy * 25 +           // Audience energy
        retentionQuality * 15           // Reduced weight for retention
    );
    
    // Update session entertainment metrics
    session.metrics.entertainmentMetrics.entertainmentScore = entertainmentScore;
    session.metrics.entertainmentMetrics.engagementIntensity = engagementIntensity;
    session.metrics.entertainmentMetrics.contentReception = contentReception;
    session.metrics.entertainmentMetrics.audienceEnergy = audienceEnergy;
    session.metrics.entertainmentMetrics.retentionQuality = retentionQuality;
    
    console.log(`🎭 [SESSION ${session.id}] Entertainment Score: ${entertainmentScore}/100 | Engagement: ${engagementIntensity.toFixed(2)} | Content: ${contentReception.toFixed(2)} | Energy: ${audienceEnergy.toFixed(2)} | Retention: ${retentionQuality.toFixed(2)} | Viewers: ${currentViewers} | Activity: ${totalActivity}`);
}

// Session-specific event handlers
function handleChatEventForSession(data, session) {
    console.log(`💬 [SESSION ${session.id}] Chat event:`, data);
    
    // Extract user information with proper fallbacks
    const { userId, nickname } = getUserInfo(data);
    const profilePicture = data.profilePictureUrl || data.user?.profilePictureUrl || '';
    
    console.log(`💬 [SESSION ${session.id}] Extracted user info:`, { userId, nickname, profilePicture });
    
    // Update session metrics
    session.metrics.totalComments++;
    session.metrics.commentsInLastMinute.push(Date.now());
    session.metrics.lastActivity = Date.now();
    
    // Track viewer activity for session
    trackViewerForSession(userId, nickname, profilePicture, session);
    
    // Update individual user activity counts
    updateSessionViewerActivity(userId, 'comment', session);
    
    // Process sentiment
    if (data.comment) {
        const sentimentResult = sentiment.analyze(data.comment);
        session.metrics.sentimentScore = sentimentResult.score;
        
        // Update rolling sentiment
        if (!session.metrics.sentimentHistory) {
            session.metrics.sentimentHistory = [];
        }
        session.metrics.sentimentHistory.push(sentimentResult.score);
        if (session.metrics.sentimentHistory.length > MAX_SENTIMENT_HISTORY) {
            session.metrics.sentimentHistory.shift();
        }
        session.metrics.rollingSentimentScore = session.metrics.sentimentHistory.reduce((a, b) => a + b, 0) / session.metrics.sentimentHistory.length;
        
        // Detect questions in comments for session
        const detectedQuestion = detectQuestionsForSession(data.comment, data.userId, data.nickname, session);
        
        // Calculate basic entertainment metrics for session
        calculateSessionEntertainmentMetrics(session);
    }
    
    // Ensure all required fields exist and update per-minute metrics
    ensureSessionMetricsFields(session);
    updateSessionPerMinuteMetrics(session);
    
    // Broadcast to session clients
    broadcastToSession(session, 'chat', {
        user: nickname || 'Anonymous',
        comment: data.comment,
        timestamp: Date.now(),
        sessionId: session.id
    });
    
    // Check for automated prompts every 5 comments
    if (session.metrics.totalComments % 5 === 0) {
        console.log(`🤖 [AI CHECK] Checking for automated prompts... (Comments: ${session.metrics.totalComments})`);
        generateAutomatedPrompt(session).then(automatedPrompt => {
            if (automatedPrompt) {
                console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                broadcastToSession(session, 'automatedPrompt', automatedPrompt);
            } else {
                console.log(`🤖 [AI CHECK] No prompts triggered at this time`);
            }
        }).catch(error => {
            console.error('🤖 [AI CHECK] Error generating prompt:', error);
        });
    }
    
    // Broadcast updated metrics immediately using global broadcast (b594427 approach)
    console.log(`📊 [SESSION ${session.id}] Broadcasting updated metrics after chat - totalComments: ${session.metrics.totalComments}`);
    broadcastGlobalMetrics();
}

function handleLikeEventForSession(data, session) {
    console.log(`❤️ [SESSION ${session.id}] Like event:`, data);
    
    // Extract user information with proper fallbacks
    const { userId, nickname } = getUserInfo(data);
    
    // Update session metrics
    session.metrics.totalLikes++;
    session.metrics.likesInLastMinute.push(Date.now());
    session.metrics.lastActivity = Date.now();
    
    // Track user likes
    if (nickname) {
        session.metrics.userLikeCounts[nickname] = (session.metrics.userLikeCounts[nickname] || 0) + 1;
    }
    
    // Track viewer activity for session
    trackViewerForSession(userId, nickname, data.profilePictureUrl, session);
    
    // Update individual user activity counts
    updateSessionViewerActivity(userId, 'like', session);
    
    // Calculate entertainment metrics for session
    calculateSessionEntertainmentMetrics(session);
    
    // Ensure all required fields exist and update per-minute metrics
    ensureSessionMetricsFields(session);
        updateSessionPerMinuteMetrics(session);
    
    // Broadcast to session clients
    broadcastToSession(session, 'like', {
        user: nickname || 'Anonymous',
        timestamp: Date.now(),
        sessionId: session.id
    });

    // Check for automated prompts every 10 likes
    if (session.metrics.totalLikes % 10 === 0) {
        console.log(`🤖 [AI CHECK] Checking for automated prompts... (Likes: ${session.metrics.totalLikes})`);
        generateAutomatedPrompt(session).then(automatedPrompt => {
            if (automatedPrompt) {
                console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                broadcastToSession(session, 'automatedPrompt', automatedPrompt);
            } else {
                console.log(`🤖 [AI CHECK] No prompts triggered at this time`);
            }
        }).catch(error => {
            console.error('🤖 [AI CHECK] Error generating prompt:', error);
        });
    }
    
    // Broadcast updated metrics immediately using global broadcast (b594427 approach)
    broadcastGlobalMetrics();
}

function handleGiftEventForSession(data, session) {
    console.log(`🎁 [SESSION ${session.id}] Gift event:`, data);
    
    // Extract gift information with proper fallbacks
    const { userId, nickname } = getUserInfo(data);
    const giftName = data.giftName || data.gift?.name || data.gift?.giftName || 'Gift';
    const giftValue = data.giftValue || data.gift?.diamondCount || data.gift?.value || 1;
    const giftId = data.giftId || data.gift?.id || 'gift';
    const profilePicture = data.profilePictureUrl || data.user?.profilePictureUrl || '';
    
    // Update session metrics
    session.metrics.totalGifts++;
    session.metrics.totalGiftDiamonds += giftValue;
    session.metrics.totalGiftValue += giftValue;
    session.metrics.giftsInLastMinute.push(Date.now());
    session.metrics.lastActivity = Date.now();
    
    // Track viewer activity for session
    trackViewerForSession(userId, nickname, profilePicture, session);
    
    // Update individual user activity counts
    updateSessionViewerActivity(userId, 'gift', session);
    
    // Update viewer's diamond count
    if (session.metrics.viewers[userId]) {
        session.metrics.viewers[userId].totalDiamonds += giftValue;
        session.metrics.viewers[userId].totalGiftValue += giftValue * 0.0127; // Convert diamonds to USD
    }
    
    // Calculate entertainment metrics for session
    calculateSessionEntertainmentMetrics(session);
    
    // Ensure all required fields exist and update per-minute metrics
    ensureSessionMetricsFields(session);
    updateSessionPerMinuteMetrics(session);
    
    // Broadcast to session clients with proper data
    broadcastToSession(session, 'gift', {
        user: nickname || 'Anonymous',
        gift: giftName,
        value: giftValue,
        giftId: giftId,
        profilePicture: profilePicture,
        timestamp: Date.now(),
        sessionId: session.id
    });
    
    // Check for automated prompts every 3 gifts
    if (session.metrics.totalGifts % 3 === 0) {
        console.log(`🤖 [AI CHECK] Checking for automated prompts... (Gifts: ${session.metrics.totalGifts})`);
        generateAutomatedPrompt(session).then(automatedPrompt => {
            if (automatedPrompt) {
                console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                broadcastToSession(session, 'automatedPrompt', automatedPrompt);
            } else {
                console.log(`🤖 [AI CHECK] No prompts triggered at this time`);
            }
        }).catch(error => {
            console.error('🤖 [AI CHECK] Error generating prompt:', error);
        });
    }
    
    // Broadcast updated metrics immediately using global broadcast (b594427 approach)
    broadcastGlobalMetrics();
}

function handleFollowEventForSession(data, session) {
    console.log(`🆕 [SESSION ${session.id}] Follow event:`, data);
    
    // Extract user information with proper fallbacks
    const { userId, nickname } = getUserInfo(data);
    
    // Update session metrics
    session.metrics.sessionFollowersGained++;
    session.metrics.lastActivity = Date.now();
    
    // Track viewer activity for session
    trackViewerForSession(userId, nickname, data.profilePictureUrl, session);
    
    // Update individual user activity counts
    updateSessionViewerActivity(userId, 'follow', session);
    
    // Add to new followers list
    if (!session.metrics.newFollowers) {
        session.metrics.newFollowers = [];
    }
    session.metrics.newFollowers.push({
        nickname: nickname || 'Anonymous',
        timestamp: Date.now()
    });
    
    // Keep only last 10 followers
    if (session.metrics.newFollowers.length > 10) {
        session.metrics.newFollowers.shift();
    }
    
    // Broadcast to session clients
    broadcastToSession(session, 'newFollower', {
        nickname: data.nickname,
        timestamp: Date.now(),
        sessionId: session.id
    });
    
    // Check for automated prompts on new followers
    console.log(`🤖 [AI CHECK] New follower detected, checking for automated prompts...`);
    generateAutomatedPrompt(session).then(automatedPrompt => {
        if (automatedPrompt) {
            console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
            broadcastToSession(session, 'automatedPrompt', automatedPrompt);
        } else {
            console.log(`🤖 [AI CHECK] No prompts triggered at this time`);
        }
    }).catch(error => {
        console.error('🤖 [AI CHECK] Error generating prompt:', error);
    });
    
    // Broadcast updated metrics immediately using global broadcast (b594427 approach)
    broadcastGlobalMetrics();
}

function handleRoomUserEventForSession(data, session) {
    console.log(`👥 [SESSION ${session.id}] Room user event:`, data);
    
    // Update current viewer count from TikTok
    if (typeof data.viewerCount === 'number') {
        session.metrics.currentViewerCount = data.viewerCount;
        session.metrics.lastActivity = Date.now();
        
        // Broadcast updated viewer count
        broadcastToSession(session, 'viewerCount', { 
            count: data.viewerCount,
            sessionId: session.id
        });
        
        // Broadcast updated metrics immediately
        broadcastToSession(session, 'metrics', {
            currentViewerCount: session.metrics.currentViewerCount,
            totalLikes: session.metrics.totalLikes,
            totalGifts: session.metrics.totalGifts,
            totalComments: session.metrics.totalComments,
            likesPerMinute: session.metrics.likesPerMinute,
            giftsPerMinute: session.metrics.giftsPerMinute,
            commentsPerMinute: session.metrics.commentsPerMinute,
            sentimentScore: session.metrics.sentimentScore,
            rollingSentimentScore: session.metrics.rollingSentimentScore,
            keywordFrequency: session.metrics.keywordFrequency,
            userLikeCounts: session.metrics.userLikeCounts,
            viewerStats: session.metrics.viewerStats,
            newFollowers: session.metrics.newFollowers,
            sessionFollowersGained: session.metrics.sessionFollowersGained,
            entertainmentMetrics: session.metrics.entertainmentMetrics,
            questionDetection: session.metrics.questionDetection,
            predictiveMetrics: session.metrics.predictiveMetrics,
            sessionId: session.id,
            username: session.username,
            timestamp: new Date().toISOString()
        });
    }
}

function extractInitialRoomStateForSession(data, session) {
    // Extract initial room state for session
    if (data && typeof data === 'object') {
        if (typeof data.totalLikes === 'number') {
            session.metrics.totalLikes = data.totalLikes;
        }
        if (typeof data.totalGifts === 'number') {
            session.metrics.totalGifts = data.totalGifts;
        }
        if (typeof data.totalComments === 'number') {
            session.metrics.totalComments = data.totalComments;
        }
        if (typeof data.viewerCount === 'number') {
            session.metrics.currentViewerCount = data.viewerCount;
        }
        
        session.metrics.lastActivity = Date.now();
        console.log(`📊 [SESSION ${session.id}] Initial room state extracted:`, {
            totalLikes: session.metrics.totalLikes,
            totalGifts: session.metrics.totalGifts,
            totalComments: session.metrics.totalComments,
            viewerCount: session.metrics.currentViewerCount
        });
    }
}

// Function to change TikTok username dynamically (updated for sessions)
async function changeTikTokUsername(newUsername, ws) {
    try {
        console.log(`🔄 [USERNAME] Changing to ${newUsername}`);
        
        // Validate username with more defensive checks
        if (!newUsername) {
            throw new Error('Username is required');
        }
        
        if (typeof newUsername !== 'string') {
            throw new Error('Username must be a string');
        }
        
        const trimmedUsername = newUsername.trim();
        if (trimmedUsername === '') {
            throw new Error('Username cannot be empty');
        }
        
        // Use the trimmed username
        newUsername = trimmedUsername;
        
        // Get or create session for this WebSocket client
        let session = getSessionByClient(ws);
        if (!session) {
            // Create new session
            session = createUserSession(newUsername, ws);
        } else {
            // Update existing session
            console.log(`🔄 [SESSION ${session.id}] Updating username from ${session.username} to ${newUsername}`);
        
        // Disconnect current connection if exists
            if (session.connection) {
                console.log(`🔌 [SESSION ${session.id}] Disconnecting current TikTok connection...`);
            try {
                    session.connection.disconnect();
            } catch (disconnectError) {
                    console.log('⚠️ [SESSION] Error during disconnect (continuing):', disconnectError.message);
                }
                session.connection = null;
            }
            
            // Update session username
            session.username = newUsername;
            session.metrics = createEmptyMetrics();
        }
        
        console.log(`✅ [SESSION ${session.id}] Username updated to: ${session.username}`);
        
        // Notify client of username change
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'usernameChanged',
                username: newUsername,
                sessionId: session.id,
                message: `Switched to @${newUsername}`
            }));
            console.log('📤 [USERNAME] Sent usernameChanged message to dashboard');
        }
        
        // Connect to new username
        console.log(`🔗 [SESSION ${session.id}] Starting connection to new username...`);
        
        // Send progress update
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'connectionProgress',
                username: newUsername,
                sessionId: session.id,
                message: 'Connecting to TikTok Live...',
                status: 'connecting'
            }));
        }
        
        await connectToTikTokForSession(session);
        
        // Send success message after connection
        console.log(`✅ [SESSION ${session.id}] Successfully connected to new username`);
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'usernameChanged',
                username: newUsername,
                sessionId: session.id,
                message: `Successfully connected to @${newUsername}`,
                status: 'success'
            }));
        }
        
    } catch (error) {
        console.error('❌ [USERNAME] Error changing username:', error.message);
        console.error('❌ [USERNAME] Error stack:', error.stack);
        
        // Provide more specific error messages
        let errorMessage = error.message || 'Unknown error occurred';
        if (error.message.includes('Rate Limited') || error.message.includes('rate_limit')) {
            errorMessage = 'TikTok API rate limit reached. Please wait a few minutes before trying again.';
        } else if (error.message.includes('Cannot read properties of undefined')) {
            errorMessage = 'Session initialization error. Please try again.';
        } else if (error.message.includes('connection')) {
            errorMessage = 'Failed to connect to TikTok Live. Please check the username and try again.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Connection timeout. Please try again.';
        } else if (error.message.includes('Too many connections')) {
            errorMessage = 'Too many connection attempts. Please wait before trying again.';
        }
        
        // Send detailed error to dashboard
        if (ws && ws.readyState === ws.OPEN) {
            const errorResponse = {
                type: 'usernameChangeError',
                error: errorMessage,
                username: newUsername,
                timestamp: Date.now(),
                originalError: error.message,
                isRateLimited: error.message.includes('Rate Limited') || error.message.includes('rate_limit') || error.message.includes('Too many connections')
            };
            
            console.log('📤 [USERNAME] Sending error message to dashboard:', errorResponse);
            ws.send(JSON.stringify(errorResponse));
            console.log('✅ [USERNAME] Error message sent successfully');
        } else {
            console.error('❌ [USERNAME] Cannot send error - WebSocket not ready. State:', ws?.readyState);
        }
    }
}

// Function to disconnect from TikTok
async function disconnectFromTikTok(ws) {
    try {
        console.log('❌ [USERNAME] Disconnecting from TikTok Live...');
        
        if (connection) {
            connection.disconnect();
            connection = null;
        }
        
        // Reset metrics
        resetSessionMetrics();
        
        // Notify dashboard
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'streamDisconnected',
                message: 'Disconnected from TikTok Live'
            }));
        }
        
        console.log('✅ [USERNAME] Successfully disconnected from TikTok Live');
        
    } catch (error) {
        console.error('❌ [USERNAME] Error disconnecting:', error);
    }
}

// Load environment variables
require('dotenv').config();

let TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || ""; // Start with no username - will be set via dashboard

async function connectToTikTok() {
    if (isConnecting) return;
    
    // Check if username is set
    if (!TIKTOK_USERNAME || TIKTOK_USERNAME.trim() === '') {
        console.log('⚠️ [CONNECTION] No username set. Please use the dashboard to connect to a streamer.');
        return;
    }
    
    isConnecting = true;
    console.log(`🔗 [CONNECTION] Attempting to connect to TikTok Live: ${TIKTOK_USERNAME}`);
    
    try {
        connection = new WebcastPushConnection(TIKTOK_USERNAME, {
            requestPollingIntervalMs: 3000, // Increased for better stability
            sessionId: undefined,
            clientParams: {
                "app_language": "en-US",
                "device_platform": "web",
                "webcast_sdk_version": "1.3.0",
                "web_id": "7280301053461791239",
                "msToken": "msToken",
                "browser_language": "en",
                "browser_platform": "Win32",
                "browser_name": "Mozilla",
                "browser_version": "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "browser_online": true,
                "tz_name": "America/New_York",
                "identity": "en",
                "room_id": "7280301053461791239",
                "heartbeatIntervalMs": 15000, // Increased for better stability
                "client": "web"
            },
            // Add connection timeout handling
            connectTimeoutMs: 30000, // 30 second timeout
            requestTimeoutMs: 10000   // 10 second request timeout
        });

        // Skip room info fetching before connection to speed up the process
        console.log('⚡ [CONNECTION] Skipping pre-connection room info fetch for faster connection...');
        
        // Quick connection check
        console.log('🔍 [CONNECTION] Quick connection validation...');
        if (connection.roomId) {
            console.log('🔍 [CONNECTION] Room ID found:', connection.roomId);
        }
        if (connection.uniqueId) {
            console.log('🔍 [CONNECTION] Unique ID found:', connection.uniqueId);
        }

        // Note: resetSessionMetrics function moved to global scope

        // Function to attempt fetching room info after connection
        async function fetchRoomInfoAfterConnection() {
            console.log('🔍 [ROOM INFO] Attempting to fetch room info after connection...');
            try {
                // Reduced wait time for faster response
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Try to get room info from connection state first (faster)
                if (connection && connection.state) {
                    console.log('🔍 [ROOM INFO] Checking connection state for room data...');
                    extractInitialRoomState(connection.state);
                }
                
                // Then try to fetch additional room info if needed
                if (connection && typeof connection.fetchRoomInfo === 'function') {
                    try {
                        const roomInfo = await connection.fetchRoomInfo();
                        console.log('📊 [ROOM INFO] Room info fetched after connection:', roomInfo);
                        // Extract totals from room info
                        extractRoomInfoTotals(roomInfo);
                    } catch (fetchError) {
                        console.log('⚠️ [ROOM INFO] Room info fetch failed, using connection state data');
                    }
                }
                
            } catch (error) {
                console.error('❌ [ROOM INFO] Failed to fetch room info after connection:', error);
            }
        }

        // Connection event handlers
        connection.on('connected', (state) => {
            console.log('✅ [CONNECTION] Connected to TikTok Live!');
            console.log('📊 [CONNECTION] Room info:', state);
            isConnecting = false;
            reconnectAttempts = 0;
            
            // Clear connection timeout since we're connected
            clearTimeout(connectionTimeout);
            
            // Reset session metrics for new stream
            resetSessionMetrics();
            
            // Extract initial room state (existing totals from TikTok)
            extractInitialRoomState(state);
            
            // Attempt to fetch room info after connection is established
            fetchRoomInfoAfterConnection();
            
            // Broadcast connection status
            broadcastEvent('connected', { status: 'connected', roomInfo: state });
        });



        connection.on('disconnected', (reason) => {
            console.log('❌ [CONNECTION] Disconnected from TikTok Live:', reason);
            isConnecting = false;
            
            // Broadcast disconnection status
            broadcastEvent('disconnected', { status: 'disconnected', reason });
            
            // Attempt reconnection if not max attempts
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`🔄 [RECONNECTION] Attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay/1000}s...`);
                setTimeout(() => {
                    if (!isConnecting) {
                        connectToTikTok();
                    }
                }, reconnectDelay);
            } else {
                console.error('❌ [RECONNECTION] Max reconnection attempts reached. Please restart manually.');
            }
        });

        connection.on('error', (error) => {
            console.error('❌ [CONNECTION] TikTok connection error:', error);
            isConnecting = false;
            
            // Handle specific error types
            if (error.message && error.message.includes('timeout')) {
                console.error('⏰ [CONNECTION] Connection timeout detected. Possible causes:');
                console.error('   - Username may be incorrect or not live streaming');
                console.error('   - TikTok API may be experiencing issues');
                console.error('   - Network connectivity problems');
                console.error('   - Rate limiting from TikTok');
                
                // Broadcast timeout error
                broadcastEvent('connectionError', { 
                    type: 'timeout', 
                    message: 'Connection timeout. Please check if the username is correct and the user is live streaming.',
                    username: TIKTOK_USERNAME
                });
            }
            
            // Broadcast general error
            broadcastEvent('connectionError', { 
                type: 'general', 
                message: error.message || 'Unknown connection error',
                username: TIKTOK_USERNAME
            });
        });

        // Add connection timeout handler
        const connectionTimeout = setTimeout(() => {
            if (isConnecting) {
                console.error('⏰ [CONNECTION] Connection timeout after 30 seconds');
                isConnecting = false;
                
                // Broadcast timeout error
                broadcastEvent('connectionError', { 
                    type: 'timeout', 
                    message: 'Connection timeout. Please check if the username is correct and the user is live streaming.',
                    username: TIKTOK_USERNAME
                });
                
                // Attempt reconnection
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`🔄 [RECONNECTION] Attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay/1000}s...`);
                    setTimeout(() => {
                        if (!isConnecting) {
                            connectToTikTok();
                        }
                    }, reconnectDelay);
                }
            }
        }, 30000); // 30 second timeout

        // Event handlers for live stream data
        connection.on('chat', (data) => {
            const { userId, nickname } = getUserInfo(data);
            const cleanedComment = cleanComment(data.comment);
            
            // Track viewer activity for watch time
            if (userId) {
                updateViewerActivity(userId, 'comment');
            }
            
            if (cleanedComment) { // Only process non-trivial comments
                // Increment total comments
                metrics.totalComments++;
                commentsInLastMinute.push(Date.now());
                
                // Perform sentiment analysis (with performance optimization)
                let sentimentScore = 0;
                
                // Only analyze sentiment for comments longer than 3 words (performance optimization)
                if (cleanedComment.split(' ').length > 3) {
                    const sentimentResult = sentiment.analyze(cleanedComment);
                    sentimentScore = sentimentResult.score;
                }
                
                // Update rolling sentiment
                updateRollingSentiment(sentimentScore);
                
                // Extract and track keywords
                const keywords = extractKeywords(cleanedComment);
                updateKeywordFrequency(keywords);
                
                // Detect questions in comments
                const detectedQuestion = detectQuestions(cleanedComment, userId, nickname);
                
                const commentData = {
                    userId,
                    nickname,
                    comment: cleanedComment,
                    sentimentScore: sentimentScore,
                    timestamp: new Date(),
                    originalComment: data.comment,
                    isQuestion: !!detectedQuestion,
                    questionPriority: detectedQuestion ? detectedQuestion.priority : null
                };
                
                metrics.recentComments.unshift(commentData);
                if (metrics.recentComments.length > 50) {
                    metrics.recentComments = metrics.recentComments.slice(0, 50);
                }
                
                // Update overall sentiment score (use rolling average for stability)
                metrics.sentimentScore = Math.round(metrics.rollingSentimentScore * 10);
                
                console.log(`💬 [${metrics.totalComments}] ${nickname}: ${cleanedComment} (Sentiment: ${sentimentScore})`);
                broadcastEvent('chat', commentData);
                
                // Check for automated prompts more frequently - every 5 comments instead of 10
                if (metrics.totalComments % 5 === 0) {
                    console.log(`🤖 [AI CHECK] Checking for automated prompts... (Comments: ${metrics.totalComments})`);
                    generateAutomatedPrompt().then(automatedPrompt => {
                    if (automatedPrompt) {
                        console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                        broadcastEvent('automatedPrompt', automatedPrompt);
                    } else {
                        console.log(`🤖 [AI CHECK] No prompts triggered at this time`);
                    }
                    }).catch(error => {
                        console.error('🤖 [AI CHECK] Error generating prompt:', error);
                    });
                }
            }
        });

        connection.on('like', (data) => {
            const { userId, nickname } = getUserInfo(data);
            
            console.log('❤️ [LIKE] Like event received:', data);
            console.log('❤️ [LIKE] Data structure:', JSON.stringify(data, null, 2));
            
            // Track viewer activity for watch time
            if (userId) {
                updateViewerActivity(userId, 'like');
                
                // Check and update follower status
                checkAndUpdateFollowerStatus(userId, data);
            }
            
            // Use totalLikeCount from TikTok if available (like TikTok-Chat-Reader)
            if (typeof data.totalLikeCount === 'number') {
                metrics.totalLikes = data.totalLikeCount;
                console.log(`❤️ [LIKES] Total likes from TikTok: ${data.totalLikeCount}`);
            } else {
                // Fallback to incrementing if totalLikeCount not available
                metrics.totalLikes++;
                console.log(`❤️ [LIKES] Incrementing total likes (no totalLikeCount): ${metrics.totalLikes}`);
            }
            
            likesInLastMinute.push(Date.now());
            
            // Track likes per user for engagement metrics
            if (!metrics.userLikeCounts[userId]) {
                metrics.userLikeCounts[userId] = {
                    nickname: nickname,
                    totalLikes: 0,
                    lastLikeTime: null
                };
            }
            
            metrics.userLikeCounts[userId].totalLikes++;
            metrics.userLikeCounts[userId].lastLikeTime = new Date();
            
            // Extract like count from the data - handle different possible structures
            let likeCount = 1; // Default to 1 like
            if (data.likeCount && typeof data.likeCount === 'number') {
                likeCount = data.likeCount;
            } else if (data.count && typeof data.count === 'number') {
                likeCount = data.count;
            } else if (data.totalLikeCount && typeof data.totalLikeCount === 'number') {
                likeCount = data.totalLikeCount;
            }
            
            const likeData = {
                userId,
                nickname,
                likeCount: likeCount,
                userTotalLikes: metrics.userLikeCounts[userId].totalLikes,
                timestamp: new Date()
            };
            
            metrics.recentLikes.unshift(likeData);
            if (metrics.recentLikes.length > 20) {
                metrics.recentLikes = metrics.recentLikes.slice(0, 20);
            }
            
            // Show the actual like count in console, not the user's total
            console.log(`❤️ [${metrics.totalLikes}] ${nickname} sent ${likeCount} likes (User Total: ${likeData.userTotalLikes})`);
            
            // Debug: Log raw like data structure for first few likes to see all available fields
            if (metrics.totalLikes <= 5) {
                console.log(`🔍 [DEBUG] Raw LIKE data structure:`);
                console.log(JSON.stringify(data, null, 2));
                console.log("🔍 [DEBUG] Available top-level keys:", Object.keys(data));
                console.log(`🔍 [DEBUG] likeCount: ${data.likeCount}, count: ${data.count}, totalLikeCount: ${data.totalLikeCount}`);
                if (data.user) {
                    console.log("🔍 [DEBUG] User object keys:", Object.keys(data.user));
                }
                console.log("-" .repeat(30));
            }
            
            broadcastEvent('like', likeData);
        });

        connection.on('gift', (data) => {
            const { userId, nickname } = getUserInfo(data);
            const gift = getGiftInfo(data);
            
            // Calculate diamonds earned from this gift (like TikTok-Chat-Reader)
            const diamondCount = data.diamondCount || 0;
            const repeatCount = data.repeatCount || 1;
            const totalDiamonds = diamondCount * repeatCount;
            
            // Calculate USD value of the gift
            const giftName = gift.name || 'Unknown';
            const giftValue = GIFT_VALUES[giftName] || { diamonds: totalDiamonds, usd: totalDiamonds * 0.0127 }; // Default: 1 diamond = $0.0127 (based on TikTok pricing)
            const totalUSDValue = giftValue.usd * repeatCount;
            
            // Track viewer activity for watch time and update viewer's diamond count
            if (userId && metrics.viewers[userId]) {
                updateViewerActivity(userId, 'gift');
                // Update viewer's total diamonds spent and USD value
                metrics.viewers[userId].totalDiamonds += totalDiamonds;
                metrics.viewers[userId].totalGiftValue += totalUSDValue;
                
                // Check and update follower status
                checkAndUpdateFollowerStatus(userId, data);
            }
            
            // Add to total gifts earned (both diamonds and USD value)
            metrics.totalGifts += totalDiamonds;
            metrics.totalGiftDiamonds += totalDiamonds;
            metrics.totalGiftValue += totalUSDValue;
            giftsInLastMinute.push(Date.now());
            
            console.log(`🎁 [GIFT] ${nickname} sent ${gift.name} (${totalDiamonds} diamonds total)`);
            
            const giftData = {
                userId,
                nickname,
                profilePic: data.profilePictureUrl || data.user?.avatarThumb?.urlList?.[0] || data.userDetails?.profilePictureUrls?.[0] || null,
                gift: gift,
                timestamp: new Date(),
                diamondCount: totalDiamonds,
                usdValue: totalUSDValue,
                giftName: giftName
            };
            
            metrics.recentGifts.unshift(giftData);
            if (metrics.recentGifts.length > 20) {
                metrics.recentGifts = metrics.recentGifts.slice(0, 20);
            }
            
            // Track gift values over time for analytics
            metrics.recentGiftValues.push({
                timestamp: Date.now(),
                diamonds: totalDiamonds,
                usdValue: totalUSDValue,
                giftName: giftName
            });
            if (metrics.recentGiftValues.length > 100) {
                metrics.recentGiftValues = metrics.recentGiftValues.slice(-100);
            }
            
            // Handle undefined diamond counts gracefully
            const diamondDisplay = gift.diamondCount !== 'Unknown' && gift.diamondCount !== undefined ? 
                `${gift.diamondCount} diamonds` : 'unknown value';
            
            console.log(`🎁 [${metrics.totalGifts}] ${nickname} sent ${gift.name} (${diamondDisplay})`);
            
            // Debug: Log raw gift data structure for first few gifts
            if (metrics.totalGifts <= 5) {
                console.log(`🔍 [DEBUG] Raw GIFT data structure:`);
                console.log(JSON.stringify(data, null, 2));
                console.log("🔍 [DEBUG] Available top-level keys:", Object.keys(data));
                console.log(`🔍 [DEBUG] Gift info extracted:`, gift);
                console.log("-" .repeat(30));
            }
            
            broadcastEvent('gift', giftData);
        });

        // Handle social events (follows, shares, etc.)
        connection.on('social', (data) => {
            const { userId, nickname } = getUserInfo(data);
            
            // Check if this is a follow event
            if (data.displayType && data.displayType.includes('follow')) {
                console.log(`🆕 [FOLLOW] ${nickname} started following!`);
                console.log(`🔍 [FOLLOW DEBUG] Data structure:`, JSON.stringify(data, null, 2));
                
                // Track viewer activity for watch time
                if (userId) {
                    updateViewerActivity(userId, 'follow');
                }
                
                // Use the centralized function to add new follower (has built-in deduplication)
                addNewFollower(userId, nickname, data.user?.avatarThumb?.urlList?.[0] || null);
            }
        });
        
        // Handle share events specifically
        connection.on('share', (data) => {
            const { userId, nickname } = getUserInfo(data);
            
            console.log('📤 [SHARE] Share event received:', data);
            console.log('📤 [SHARE] Data structure:', JSON.stringify(data, null, 2));
            
            // Track viewer activity for watch time
            if (userId) {
                updateViewerActivity(userId, 'share');
            }
            
            // Use totalShares from TikTok if available (like TikTok-Chat-Reader)
            if (typeof data.totalShares === 'number') {
                metrics.totalShares = data.totalShares;
                console.log(`📤 [SHARES] Total shares from TikTok: ${data.totalShares}`);
            } else {
                // Fallback to incrementing if totalShares not available
                metrics.totalShares++;
                console.log(`📤 [SHARES] Incrementing total shares (no totalShares): ${metrics.totalShares}`);
            }
            
            // Track shares per user for engagement metrics
            if (!metrics.userLikeCounts[userId]) {
                metrics.userLikeCounts[userId] = {
                    nickname: nickname,
                    totalShares: 0,
                    lastShareTime: null
                };
            }
            
            metrics.userLikeCounts[userId].totalShares++;
            metrics.userLikeCounts[userId].lastShareTime = new Date();
            
            // Extract share count from the data - handle different possible structures
            let shareCount = 1; // Default to 1 share
            if (data.shareCount && typeof data.shareCount === 'number') {
                shareCount = data.shareCount;
            } else if (data.count && typeof data.count === 'number') {
                shareCount = data.count;
            } else if (data.totalShares && typeof data.totalShares === 'number') {
                shareCount = data.totalShares;
            }
            
            const shareData = {
                userId,
                nickname,
                shareCount: shareCount,
                userTotalShares: metrics.userLikeCounts[userId].totalShares,
                timestamp: new Date(),
                profilePic: data.user?.avatarThumb?.urlList?.[0] || null
            };
            
            // Add to recent shares
            metrics.recentShares.unshift(shareData);
            if (metrics.recentShares.length > 20) {
                metrics.recentShares = metrics.recentShares.slice(0, 20);
            }
            
            // Track for per-minute metrics
            sharesInLastMinute.push(Date.now());
            
            // Update session totals
            metrics.sessionShares += shareCount;
            
            // Broadcast share event
            broadcastEvent('share', shareData);
            
            console.log(`📤 [${metrics.totalShares}] ${nickname}: Share (${shareCount})`);
            
            // Check for automated prompts every 5 shares
            if (metrics.totalShares % 5 === 0) {
                console.log(`🤖 [AI CHECK] Checking for automated prompts... (Shares: ${metrics.totalShares})`);
                generateAutomatedPrompt().then(automatedPrompt => {
                if (automatedPrompt) {
                    console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                    broadcastEvent('automatedPrompt', automatedPrompt);
                }
                }).catch(error => {
                    console.error('🤖 [AI CHECK] Error generating prompt:', error);
                });
            }
        });



        // Helper function to check if user is a follower
        function checkAndUpdateFollowerStatus(userId, data) {
            if (!userId || !metrics.viewers[userId]) return;
            
            // Skip if we already know this user is a follower
            if (metrics.viewers[userId].isFollower) {
                return;
            }
            
            // Check multiple follower indicators from TikTok
            const isFollower = data.followRole === 1 || 
                              data.followStatus === 1 || 
                              (data.followInfo && data.followInfo.followStatus === 1) ||
                              (data.displayType && data.displayType.includes('follow'));
            
            console.log(`🔍 [FOLLOWER CHECK] Checking ${metrics.viewers[userId].nickname} (${userId}) for follower status`);
            console.log(`🔍 [FOLLOWER CHECK] Data:`, {
                followRole: data.followRole,
                followStatus: data.followStatus,
                followInfo: data.followInfo,
                displayType: data.displayType,
                isFollower: isFollower,
                wasFollower: metrics.viewers[userId].isFollower
            });
            
            if (isFollower && !metrics.viewers[userId].isFollower) {
                console.log(`👑 [FOLLOWER DETECTED] ${metrics.viewers[userId].nickname} is a follower!`);
                metrics.viewers[userId].isFollower = true;
                metrics.viewers[userId].followTime = new Date();
                
                // Use the centralized function to add new follower
                addNewFollower(userId, metrics.viewers[userId].nickname, metrics.viewers[userId].profilePic);
            }
        }

        // AI Welcome System for New Viewers - Consolidated Member Handler
        connection.on('member', (data) => {
            console.log('🎯 [MEMBER] Member event received:', data);
            
            const { userId, nickname } = getUserInfo(data);
            
            // Extract profile picture like TikTok-Chat-Reader does
            let profilePic = null;
            if (data.profilePictureUrl) {
                profilePic = data.profilePictureUrl;
            } else if (data.user?.avatarThumb?.urlList?.[0]) {
                profilePic = data.user.avatarThumb.urlList[0];
            } else if (data.userDetails?.profilePictureUrls?.[0]) {
                profilePic = data.userDetails.profilePictureUrls[0];
            }
            
            if (userId && nickname) {
                console.log(`🎯 [MEMBER] Processing viewer: ${nickname} (${userId})`);
                
                // Add viewer to tracking (only once)
                addViewer(userId, nickname, profilePic);
                
                // Check and update follower status
                checkAndUpdateFollowerStatus(userId, data);
                
                // Check if this is a new viewer during stream start (1-10 viewers)
                if (metrics.currentViewerCount >= 1 && metrics.currentViewerCount <= 10) {
                    // Check if this is a new viewer (not rejoining)
                    const viewer = metrics.viewers[userId];
                    if (viewer && !viewer.hasBeenWelcomed) {
                        // Add timestamp-based protection against race conditions
                        const now = Date.now();
                        if (!viewer.welcomeTimestamp || (now - viewer.welcomeTimestamp) > 5000) { // 5 second protection
                        viewer.hasBeenWelcomed = true;
                            viewer.welcomeTimestamp = now;
                        
                        // Generate AI welcome message and tips
                        const welcomeData = generateAIWelcome(nickname, metrics.currentViewerCount);
                        
                        console.log(`🤖 [AI WELCOME] New viewer: ${nickname} | Welcome: ${welcomeData.welcomeMessage}`);
                        console.log(`💡 [AI TIPS] Engagement tips: ${welcomeData.engagementTips}`);
                        
                            // Broadcast AI welcome event for Chat activity
                        broadcastEvent('aiWelcome', {
                            viewer: { userId, nickname, profilePic },
                            welcomeMessage: welcomeData.welcomeMessage,
                            engagementTips: welcomeData.engagementTips,
                            viewerCount: metrics.currentViewerCount,
                            timestamp: new Date()
                        });
                            
                            // ALSO send comprehensive prompt to Live Assistant section
                            const comprehensivePrompt = {
                                type: 'viewer_engagement_comprehensive',
                                priority: 'high',
                                message: `${welcomeData.welcomeMessage}\n\n${welcomeData.engagementTips.join('\n\n')}`,
                                trigger: 'new_viewer_comprehensive_engagement',
                                action: 'engage_new_viewer_comprehensive',
                                source: 'viewer_specific_comprehensive',
                                targetViewer: nickname,
                                timestamp: new Date(),
                                // Include all the individual components for reference
                                welcomeMessage: welcomeData.welcomeMessage,
                                engagementTips: welcomeData.engagementTips,
                                retentionStrategies: welcomeData.retentionStrategies,
                                viewerCount: welcomeData.viewerCount
                            };
                            
                            // Send to Live Assistant section
                            console.log(`🤖 [LIVE ASSISTANT] Sending comprehensive viewer engagement to Live Assistant for ${nickname}`);
                            broadcastEvent('automatedPrompt', comprehensivePrompt);
                            
                            // Update cooldown tracking to prevent spam
                            metrics.lastPromptTime = Date.now();
                            if (!metrics.promptCooldowns) metrics.promptCooldowns = {};
                            metrics.promptCooldowns[comprehensivePrompt.trigger] = Date.now();
                        } else {
                            console.log(`🤖 [AI WELCOME] Skipping duplicate welcome for ${nickname} - too soon (${now - viewer.welcomeTimestamp}ms)`);
                        }
                    } else if (viewer && viewer.hasBeenWelcomed) {
                        console.log(`🤖 [AI WELCOME] Skipping welcome for ${nickname} (already welcomed)`);
                    }
                }
                
                // Check if this contains room totals
                if (data.roomStats || data.totalLikes || data.totalGifts) {
                    extractInitialRoomState(data);
                }
            } else {
                console.log('⚠️ [MEMBER] Missing userId or nickname:', { userId: data.userId, nickname: data.nickname });
            }
        });

        connection.on('roomUser', (data) => {
            const viewerCount = data.viewerCount || data.viewer || 0;
            const totalUserCount = data.totalUserCount || data.totalUser || data.totalCount || data.userCount || data.memberCount || 0;
            
            // Track viewer history for AI analysis
            metrics.viewerHistory.push({
                count: viewerCount,
                timestamp: new Date()
            });
            
            // Keep only last 60 entries (1 hour of data at 1-minute intervals)
            if (metrics.viewerHistory.length > 60) {
                metrics.viewerHistory = metrics.viewerHistory.slice(-60);
            }
            
            metrics.currentViewerCount = viewerCount;
            
            const roomData = {
                viewerCount,
                totalUserCount,
                timestamp: new Date()
            };
            
            console.log(`👥 [ROOM] Viewers: ${viewerCount} | Total Users: ${totalUserCount}`);
            broadcastEvent('roomUser', roomData);
        });

        // Add catch-all event handler to see what other events are available
        connection.on('*', (eventName, data) => {
            console.log(`🔍 [EVENT] Received event: ${eventName}`, data);
            
            // Check if this event contains initial room totals
            if (eventName === 'roomInfo' || eventName === 'roomStats' || eventName === 'liveInfo') {
                console.log(`🎯 [ROOM INFO] Found room info event:`, data);
                extractInitialRoomState(data);
            }
            
            // More aggressive search for any data that might contain room totals
            if (data && typeof data === 'object') {
                // Look for any numeric values that could be totals
                const numericValues = findNumericValues(data);
                if (numericValues.length > 0) {
                    console.log(`🔍 [NUMERIC] Event ${eventName} contains numeric values:`, numericValues);
                    // Check if any of these look like room totals (large numbers)
                    const potentialTotals = numericValues.filter(val => val > 1000);
                    if (potentialTotals.length > 0) {
                        console.log(`🎯 [ROOM INFO] Found large numbers that might be totals:`, potentialTotals);
                    }
                }
                
                // Check for specific keys that might indicate room totals
                if (data.totalLikes || data.totalGifts || data.totalComments || data.roomStats || data.stats) {
                    console.log(`🎯 [ROOM DATA] Event ${eventName} contains room data:`, data);
                    extractInitialRoomState(data);
                }
            }
        });

        // Add specific event handlers for potential room info events
        connection.on('roomInfo', (data) => {
            console.log('🎯 [ROOM INFO] Room info event received:', data);
            extractInitialRoomState(data);
        });

        connection.on('liveInfo', (data) => {
            console.log('🎯 [LIVE INFO] Live info event received:', data);
            extractInitialRoomState(data);
        });

        connection.on('roomStats', (data) => {
            console.log('🎯 [ROOM STATS] Room stats event received:', data);
            extractInitialRoomState(data);
        });

        // Add event handlers based on TikTok-Chat-Reader implementation
        connection.on('roomUser', (data) => {
            console.log('👥 [ROOM USER] Room user event received:', data);
            console.log('👥 [ROOM USER] Data structure:', JSON.stringify(data, null, 2));
            
            // Update current viewer count from TikTok
            if (typeof data.viewerCount === 'number') {
                metrics.currentViewerCount = data.viewerCount;
                console.log(`👥 [ROOM] Current viewer count: ${data.viewerCount}`);
                
                // Broadcast updated viewer count
                broadcastEvent('viewerCount', { count: data.viewerCount });
            }
            
            // Check if this contains room totals
            if (data.roomStats || data.totalLikes || data.totalGifts) {
                extractInitialRoomState(data);
            }
        });





        // Add event handler for any event that might contain room totals
        connection.on('*', (eventName, data) => {
            console.log(`🔍 [EVENT] Received event: ${eventName}`, data);
            
            // Check if this event contains initial room totals
            if (eventName === 'roomInfo' || eventName === 'roomStats' || eventName === 'liveInfo' ||
                eventName === 'member' || eventName === 'join') {
                console.log(`🎯 [ROOM INFO] Found room info event: ${eventName}`, data);
                extractInitialRoomState(data);
            }
            
            // Also check if the data object itself contains room totals
            if (data && (data.totalLikes || data.totalGifts || data.totalComments || data.roomStats)) {
                console.log(`🎯 [ROOM DATA] Event ${eventName} contains room data:`, data);
                extractInitialRoomState(data);
            }
        });
        
        // Add specific handler for room data events
        connection.on('roomData', (data) => {
            console.log('🎯 [ROOM DATA] Room data event received:', data);
            extractInitialRoomState(data);
        });
        
        connection.on('roomStats', (data) => {
            console.log('🎯 [ROOM STATS] Room stats event received:', data);
            extractInitialRoomState(data);
        });
        
        // Add handler for any numeric data that might be totals
        connection.on('*', (eventName, data) => {
            if (data && typeof data === 'object') {
                // Look for any numeric values that could be totals
                const numericValues = findNumericValues(data);
                if (numericValues.length > 0) {
                    console.log(`🔍 [NUMERIC] Event ${eventName} contains numeric values:`, numericValues);
                    // Check if any of these look like room totals
                    const potentialTotals = numericValues.filter(val => val > 1000);
                    if (potentialTotals.length > 0) {
                        console.log(`🎯 [POTENTIAL TOTALS] Found potential totals:`, potentialTotals);
                    }
                }
            }
        });

        // Connect to the live stream
        connection.connect().catch((error) => {
            console.error('❌ [CONNECTION] Failed to connect:', error);
            isConnecting = false;
        });

    } catch (error) {
        console.error('❌ [CONNECTION] Error creating connection:', error);
        isConnecting = false;
    }
}

// Start the TikTok Live Data Processor (Multi-User Ready)
console.log("🎯 TikTok Live Data Processor Starting...");
console.log("🖥️  Dashboard will be available at: http://localhost:3000");
console.log("🔌 WebSocket endpoint: ws://localhost:3000");
console.log("👥 Multi-user support: ENABLED");
console.log("📡 Ready for user connections via dashboard");
console.log("=".repeat(60));

// Set up periodic metrics updates (legacy - only when no sessions active)
setInterval(() => {
    // Skip legacy metrics updates if there are active sessions
    if (userSessions.size > 0) {
        return;
    }
    updatePerMinuteMetrics();
}, 1000); // Update every second

// Set up periodic AI prompt checks - more frequent for proactive assistance (legacy - only when no sessions active)
setInterval(() => {
    // Skip legacy AI prompts if there are active sessions
    if (userSessions.size > 0) {
        return;
    }
    
    console.log(`🤖 [PERIODIC AI CHECK] Checking for automated prompts...`);
    generateAutomatedPrompt().then(automatedPrompt => {
    if (automatedPrompt) {
        console.log(`🤖 [PERIODIC AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
        broadcastEvent('automatedPrompt', automatedPrompt);
    }
    }).catch(error => {
        console.error('🤖 [PERIODIC AI CHECK] Error generating prompt:', error);
    });
}, 15000); // Check every 15 seconds for more proactive assistance

// Set up periodic viewer watch time updates (legacy - only when no sessions active)
setInterval(() => {
    // Skip legacy viewer updates if there are active sessions
    if (userSessions.size > 0) {
        return;
    }
    
    updateViewerWatchTime();
    removeInactiveViewers();
    
    // Broadcast updated viewer stats
    broadcastEvent('viewerStats', {
        totalUniqueViewers: metrics.viewerStats.totalUniqueViewers,
        averageWatchTime: metrics.viewerStats.averageWatchTime,
        longestWatchTime: metrics.viewerStats.longestWatchTime,
        viewersByWatchTime: metrics.viewerStats.viewersByWatchTime,
        activeViewers: Object.values(metrics.viewers).filter(v => v.isActive).length,
        engagementRanking: getViewerEngagementRanking()
    });
}, 10000); // Update every 10 seconds

// Set up periodic cleanup of duplicate followers
setInterval(() => {
    cleanupDuplicateFollowers();
}, 60000); // Clean up every minute

// Set up proactive AI assistance for small streams (< 15 viewers) (legacy - only when no sessions active)
setInterval(() => {
    // Skip legacy AI assistance if there are active sessions
    if (userSessions.size > 0) {
        return;
    }
    
    const viewerCount = metrics.currentViewerCount || 0;
    if (viewerCount > 0 && viewerCount < 15) {
        console.log(`🤖 [SMALL STREAM AI] Proactive assistance for ${viewerCount} viewers...`);
        generateAutomatedPrompt().then(automatedPrompt => {
            if (automatedPrompt) {
                console.log(`🤖 [SMALL STREAM AI] Generated proactive prompt: ${automatedPrompt.message}`);
                broadcastEvent('automatedPrompt', automatedPrompt);
            }
        }).catch(error => {
            console.error('🤖 [SMALL STREAM AI] Error generating prompt:', error);
        });
    }
}, 20000); // Check every 20 seconds for small streams

// Note: Removed periodic room info fetching to restore original behavior
// Historical data is now fetched once before connection and broadcasted immediately

// TikTok connection will be initiated via dashboard username input
// No auto-connection on startup - wait for user to specify streamer





app.get('/metrics', (req, res) => {
    res.json(metrics);
});

// API endpoint to manually set current room totals
app.post('/set-totals', (req, res) => {
    try {
        const { likes, gifts, comments, viewers } = req.body;
        
        if (likes === undefined && gifts === undefined && comments === undefined && viewers === undefined) {
            return res.status(400).json({ 
                error: 'At least one value must be provided',
                usage: 'POST /set-totals with JSON body: { "likes": 201, "gifts": 15, "comments": 45, "viewers": 120 }'
            });
        }
        
        setCurrentRoomTotals(likes, gifts, comments, viewers);
        
        res.json({ 
            success: true, 
            message: 'Room totals updated successfully',
            currentTotals: {
                totalLikes: metrics.totalLikes,
                totalGifts: metrics.totalGifts,
                totalComments: metrics.totalComments,
                currentViewerCount: metrics.currentViewerCount
            }
        });
        
    } catch (error) {
        console.error('❌ [API] Error setting totals:', error);
        res.status(500).json({ error: 'Failed to set totals', details: error.message });
    }
});

// API endpoint to get current room totals
app.get('/totals', (req, res) => {
    res.json({
        totalLikes: metrics.totalLikes,
        totalGifts: metrics.totalGifts,
        totalGiftDiamonds: metrics.totalGiftDiamonds,
        totalGiftValue: metrics.totalGiftValue,
        totalComments: metrics.totalComments,
        currentViewerCount: metrics.currentViewerCount,
        sessionFollowersGained: metrics.sessionFollowersGained
    });
});

// API endpoint to get gift analytics
app.get('/gift-analytics', (req, res) => {
    // Calculate top gift givers
    const topGiftGivers = Object.values(metrics.viewers)
        .filter(v => v.totalGiftValue > 0)
        .sort((a, b) => b.totalGiftValue - a.totalGiftValue)
        .slice(0, 10)
        .map(v => ({
            nickname: v.nickname,
            totalGifts: v.totalGifts,
            totalDiamonds: v.totalDiamonds,
            totalValue: v.totalGiftValue,
            watchTime: v.watchTime
        }));
    
    // Calculate gift value trends
    const recentGifts = metrics.recentGiftValues.slice(-50); // Last 50 gifts
    const giftTrends = {
        totalValue: recentGifts.reduce((sum, g) => sum + g.usdValue, 0),
        averageValue: recentGifts.length > 0 ? recentGifts.reduce((sum, g) => sum + g.usdValue, 0) / recentGifts.length : 0,
        topGift: recentGifts.length > 0 ? recentGifts.reduce((max, g) => g.usdValue > max.usdValue ? g : max) : null
    };
    
    res.json({
        totalGifts: metrics.totalGifts,
        totalDiamonds: metrics.totalGiftDiamonds,
        totalValue: metrics.totalGiftValue,
        perMinute: {
            count: metrics.giftsPerMinute,
            diamonds: metrics.giftsPerMinuteDiamonds,
            value: metrics.giftsPerMinuteValue
        },
        topGiftGivers: topGiftGivers,
        giftTrends: giftTrends,
        recentGifts: metrics.recentGifts.slice(0, 10)
    });
});

// HTTP endpoint for username changes (fallback when WebSocket unavailable)
app.post('/change-username', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || username.trim() === '') {
            return res.status(400).json({ 
                error: 'Username is required',
                message: 'Please provide a valid TikTok username'
            });
        }
        
        console.log('🔄 [HTTP API] Username change request:', username);
        
        // Use the existing username change logic
        await changeTikTokUsername(username, null); // Pass null for ws since this is HTTP
        
        res.json({ 
            success: true, 
            message: `Successfully connected to @${username}`,
            username: username,
            status: 'connected'
        });
        
    } catch (error) {
        console.error('❌ [HTTP API] Username change error:', error);
        res.status(500).json({ 
            error: 'Failed to change username', 
            message: error.message,
            details: 'Check server logs for more information'
        });
    }
});

// Performance monitoring endpoint
app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
        status: 'healthy',
        uptime: Math.floor(uptime),
        memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
        },
        metrics: {
            activeViewers: Object.keys(metrics.viewers).length,
            totalQuestions: metrics.questionDetection.questionStats.totalQuestions,
            sentimentHistorySize: metrics.commentSentiments.length
        },
        timestamp: new Date().toISOString()
    });
});

// Simple test endpoint for Render health checks
app.get('/test', (req, res) => {
    res.json({ status: 'ok', message: 'TikTok Live Assistant is running' });
});

// Serve dashboard
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/dashboard.html');
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Debug endpoint to check current metrics and sessions
app.get('/debug', (req, res) => {
    const sessionInfo = Array.from(userSessions.entries()).map(([sessionId, session]) => ({
        sessionId: sessionId,
        username: session.username,
        connectedClients: session.wsClients.size,
        isConnecting: session.isConnecting,
        hasConnection: !!session.connection,
        createdAt: new Date(session.createdAt).toISOString(),
        lastActivity: new Date(session.lastActivity).toISOString(),
        metrics: {
            currentViewerCount: session.metrics.currentViewerCount,
            totalLikes: session.metrics.totalLikes,
            totalGifts: session.metrics.totalGifts,
            totalComments: session.metrics.totalComments
        }
    }));

    res.json({
        message: 'Current status and active sessions',
        totalSessions: userSessions.size,
        totalConnectedClients: wss.clients.size,
        sessions: sessionInfo,
        legacyMetrics: metrics, // Keep for backward compatibility
        timestamp: new Date().toISOString()
    });
});

// API endpoint to get viewer information
app.get('/api/viewers', (req, res) => {
    const { userId } = req.query;
    
    if (userId) {
        // Get specific viewer details
        const viewer = getViewerDetails(userId);
        if (viewer) {
            res.json({
                success: true,
                viewer: {
                    ...viewer,
                    watchTimeFormatted: formatWatchTime(viewer.watchTime)
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Viewer not found'
            });
        }
    } else {
        // Get all active viewers with engagement ranking
        const activeViewers = getActiveViewers();
        const engagementRanking = getViewerEngagementRanking();
        
        res.json({
            success: true,
            stats: {
                totalUniqueViewers: metrics.viewerStats.totalUniqueViewers,
                activeViewers: activeViewers.length,
                averageWatchTime: metrics.viewerStats.averageWatchTime,
                longestWatchTime: metrics.viewerStats.longestWatchTime,
                viewersByWatchTime: metrics.viewerStats.viewersByWatchTime
            },
            activeViewers: activeViewers.map(v => ({
                ...v,
                watchTimeFormatted: formatWatchTime(v.watchTime)
            })),
            engagementRanking: engagementRanking.slice(0, 10) // Top 10 most engaged viewers
        });
    }
});

// WebSocket connection handling (updated for multi-user sessions)
wss.on('connection', (ws) => {
    console.log('🖥️ [WEBSOCKET] Dashboard connected');
    console.log(`📊 Total connected clients: ${wss.clients.size}`);
    console.log(`📊 Total active sessions: ${userSessions.size}`);
    
    // Send initial session info (no metrics until user connects to a stream)
    ws.send(JSON.stringify({
        type: 'sessionInfo',
        data: {
            sessionId: null,
            username: null,
            status: 'disconnected',
            totalSessions: userSessions.size,
            message: 'Welcome! Enter a TikTok username to start monitoring a live stream.'
        }
    }));
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 [WEBSOCKET] Received message:', data.type);
            
            switch (data.type) {
                case 'changeUsername':
                    console.log('🔄 [WEBSOCKET] Username change request:', data.username);
                    
                    // Validate username data
                    if (!data.username) {
                        console.error('❌ [WEBSOCKET] No username provided in changeUsername request');
                ws.send(JSON.stringify({
                            type: 'usernameChangeError',
                            error: 'No username provided',
                            username: data.username || 'undefined',
                            timestamp: Date.now()
                        }));
                        break;
                    }
                    
                    try {
                        await changeTikTokUsername(data.username, ws);
                    } catch (error) {
                        console.error('❌ [WEBSOCKET] Username change error:', error);
                        ws.send(JSON.stringify({
                            type: 'usernameChangeError',
                            error: error.message,
                            username: data.username,
                            timestamp: Date.now()
                        }));
                    }
                    break;
                    
                case 'disconnectStream':
                    console.log('❌ [WEBSOCKET] Disconnect request received');
                    try {
                        const session = getSessionByClient(ws);
                        if (session && session.connection) {
                            console.log(`🔌 [SESSION ${session.id}] Disconnecting TikTok connection...`);
                            
                            // Remove all event listeners before disconnecting
                            session.connection.removeAllListeners();
                            
                            // Disconnect the connection
                            try {
                                session.connection.disconnect();
                            } catch (disconnectError) {
                                console.log('⚠️ [SESSION] Error during disconnect (continuing cleanup):', disconnectError.message);
                            }
                            
                            // Set connection to null
                            session.connection = null;
                            
                            // Reset connection flags
                            session.isConnecting = false;
                            session.reconnectAttempts = 0;
                            
                            console.log(`✅ [SESSION ${session.id}] Stream disconnected successfully`);
                            
                            // Reset session metrics
                            session.metrics = createEmptyMetrics();
                            
                            // Broadcast disconnect to session clients
                            broadcastToSession(session, 'streamDisconnected', { 
                                message: 'Stream disconnected successfully',
                                sessionId: session.id,
                                username: session.username
                            });
                        } else {
                            console.log('⚠️ [WEBSOCKET] No active session or connection to disconnect');
                            ws.send(JSON.stringify({
                                type: 'streamDisconnected',
                                data: { message: 'No active connection' }
                            }));
                        }
                    } catch (error) {
                        console.error('❌ [WEBSOCKET] Disconnect error:', error);
                        ws.send(JSON.stringify({
                            type: 'streamDisconnected',
                            data: { message: 'Error disconnecting: ' + error.message }
                        }));
                    }
                    break;
                    
                case 'test':
                    console.log('🧪 [WEBSOCKET] Test message received');
                    ws.send(JSON.stringify({ type: 'test', data: 'pong' }));
                    break;
                    
                case 'setLanguage':
                    console.log('🌍 [WEBSOCKET] Language change request:', data.language);
                    currentLanguage = data.language;
                    console.log('✅ [WEBSOCKET] Language set to:', currentLanguage);
                    ws.send(JSON.stringify({ 
                        type: 'languageSet', 
                        data: { language: currentLanguage } 
                    }));
                    break;
                    
                default:
                    console.log('❓ [WEBSOCKET] Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('❌ [WEBSOCKET] Error parsing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                data: { error: 'Invalid message format' }
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('🖥️ [WEBSOCKET] Dashboard disconnected');
        
        // Remove client from any session
        const session = removeClientFromSession(ws);
        if (session) {
            console.log(`📤 [SESSION ${session.id}] Removed client from session`);
        }
        
        console.log(`📊 Total connected clients: ${wss.clients.size}`);
        console.log(`📊 Total active sessions: ${userSessions.size}`);
    });
    
    ws.on('error', (error) => {
        console.error('❌ [WEBSOCKET] WebSocket error:', error);
    });
});

// Function to reset all metrics when disconnecting
function resetMetrics() {
    console.log('🔄 [METRICS] Resetting all metrics...');
    
    // Reset session-specific metrics
    resetSessionMetrics();
    
    // Reset cumulative totals
    metrics.totalLikes = 0;
    metrics.totalGifts = 0;
    metrics.totalGiftDiamonds = 0;
    metrics.totalGiftValue = 0;
    metrics.totalComments = 0;
    metrics.totalShares = 0;
    metrics.sessionFollowersGained = 0;
    
    // Reset per-minute metrics
    metrics.likesPerMinute = 0;
    metrics.giftsPerMinute = 0;
    metrics.giftsPerMinuteDiamonds = 0;
    metrics.giftsPerMinuteValue = 0;
    metrics.commentsPerMinute = 0;
    metrics.followersGainsPerMinute = 0;
    
    // Clear recent activity arrays
    metrics.recentComments = [];
    metrics.recentLikes = [];
    metrics.recentGifts = [];
    metrics.recentGiftValues = [];
    metrics.recentShares = [];
    
    // Reset viewer data
    metrics.viewers = {};
    metrics.viewerStats = {
        totalUniqueViewers: 0,
        averageWatchTime: 0,
        longestWatchTime: 0,
        viewersByWatchTime: {
            '0-5min': 0,
            '5-15min': 0,
            '15-30min': 0,
            '30min+': 0
        }
    };
    
    // Reset current viewer count
    metrics.currentViewerCount = 0;
    
    // Reset entertainment metrics
    metrics.entertainmentMetrics = {
        entertainmentScore: 0,
        engagementIntensity: 0,
        contentReception: 0,
        audienceEnergy: 0,
        retentionQuality: 0,
        lastEntertainmentUpdate: new Date()
    };
    
    // Reset question detection
    metrics.questionDetection = {
        pendingQuestions: [],
        answeredQuestions: [],
        questionStats: {
            totalQuestions: 0,
            answeredQuestions: 0,
            responseRate: 0,
            averageResponseTime: 0
        }
    };
    
    // Reset predictive metrics
    metrics.predictiveMetrics = {
        churnRiskScore: 0,
        viewerRetentionRate: 0,
        monetizationOpportunity: 0,
        sentimentVolatility: 0
    };
    
    // Reset stream phase
    metrics.streamPhase = 'unknown';
    
    // Reset last update
    metrics.lastUpdate = new Date();
    
    // Reset processed followers tracking to prevent duplicates in new sessions
    if (metrics.processedFollowers) {
        metrics.processedFollowers.clear();
        console.log('🧹 [METRICS] Cleared processed followers tracking');
    }
    
    console.log('✅ [METRICS] All metrics reset successfully');
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📊 Metrics API: http://localhost:${PORT}/metrics`);
    
    // Clean up any existing duplicates on server startup
    cleanupDuplicateFollowers();
    
    console.log("=".repeat(60));
    console.log("🎯 TikTok Live Assistant Ready!");
    console.log("📱 Open the dashboard and enter a streamer username to connect");
    console.log("=".repeat(60));
});

// Test function to manually test new followers tracking
function testNewFollowersTracking() {
    console.log('🧪 [TEST] Testing new followers tracking...');
    
    // Simulate a new follower
    const testFollower = {
        userId: 'test_user_' + Date.now(),
        nickname: 'TestFollower',
        profilePic: null,
        timestamp: new Date(),
        followTime: new Date()
    };
    
    // Use the centralized function to add new follower
    addNewFollower(testFollower.userId, testFollower.nickname, testFollower.profilePic);
    
    return testFollower;
}

// Make test function available globally for testing
global.testNewFollowersTracking = testNewFollowersTracking;

// Manual override function to set current room totals
function setCurrentRoomTotals(likes = null, gifts = null, comments = null, viewers = null) {
    console.log('🎯 [MANUAL OVERRIDE] Setting current room totals...');
    
    if (likes !== null && typeof likes === 'number' && likes >= 0) {
        metrics.totalLikes = likes;
        console.log(`🎯 [MANUAL OVERRIDE] Set total likes: ${likes.toLocaleString()}`);
    }
    
    if (gifts !== null && typeof gifts === 'number' && gifts >= 0) {
        metrics.totalGifts = gifts;
        console.log(`🎯 [MANUAL OVERRIDE] Set total gifts: ${gifts.toLocaleString()}`);
    }
    
    if (comments !== null && typeof comments === 'number' && comments >= 0) {
        metrics.totalComments = comments;
        console.log(`🎯 [MANUAL OVERRIDE] Set total comments: ${comments.toLocaleString()}`);
    }
    
    if (viewers !== null && typeof viewers === 'number' && viewers >= 0) {
        metrics.currentViewerCount = viewers;
        console.log(`🎯 [MANUAL OVERRIDE] Set current viewer count: ${viewers.toLocaleString()}`);
    }
    
    // Broadcast updated metrics to dashboard (only if no sessions active)
    if (userSessions.size === 0) {
    broadcastMetrics();
    }
    console.log('✅ [MANUAL OVERRIDE] Room totals updated and broadcasted');
}

// Make manual override function available globally for testing
global.setCurrentRoomTotals = setCurrentRoomTotals;

// Set up periodic metrics updates for all sessions (b594427 approach)
setInterval(() => {
    // Update per-minute metrics for each active session
    userSessions.forEach((session, sessionId) => {
        if (session.wsClients.size > 0) {
            // Update per-minute metrics
            updateSessionPerMinuteMetrics(session);
            
            // Update viewer watch times
            updateSessionViewerWatchTimes(session);
            
            // Update viewer stats
            updateSessionViewerStats(session);
            
            // Generate engagement ranking
            generateSessionEngagementRanking(session);
            
            // Calculate viewer retention
            const retentionRate = calculateSessionViewerRetention(session);
            
            // Calculate entertainment metrics
            calculateSessionEntertainmentMetrics(session);
            
            // Ensure all fields are properly initialized
            ensureSessionMetricsFields(session);
        }
    });
    
    // Use global broadcast function (b594427 approach) - single broadcast for all sessions
    if (userSessions.size > 0) {
        broadcastGlobalMetrics();
    }
}, 5000); // Broadcast every 5 seconds

// Set up periodic AI prompt checks for sessions
setInterval(() => {
    userSessions.forEach((session, sessionId) => {
        if (session.wsClients.size > 0) {
            console.log(`🤖 [PERIODIC AI CHECK] Checking for automated prompts... (Session: ${sessionId})`);
            generateAutomatedPrompt(session).then(automatedPrompt => {
                if (automatedPrompt) {
                    console.log(`🤖 [PERIODIC AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                    broadcastToSession(session, 'automatedPrompt', automatedPrompt);
        } else {
                    console.log(`🤖 [PERIODIC AI CHECK] No prompts triggered at this time`);
                }
            }).catch(error => {
                console.error('🤖 [PERIODIC AI CHECK] Error generating prompt:', error);
            });
        }
    });
}, 30000); // Check every 30 seconds
