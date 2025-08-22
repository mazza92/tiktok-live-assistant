const { WebcastPushConnection } = require('tiktok-live-connector');
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const Sentiment = require('sentiment');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure Express middleware
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Data processing and metrics storage
let metrics = {
    currentViewerCount: 0,
    
    // Cumulative totals (all-time, never reset)
    totalLikes: 0,
    totalGifts: 0,
    totalComments: 0,
    totalShares: 0,
    sessionFollowersGained: 0, // Total followers gained in current live session
    
    likesPerMinute: 0,
    giftsPerMinute: 0,
    commentsPerMinute: 0,
    followersGainsPerMinute: 0, // Track new followers gained per minute
    recentComments: [],
    recentLikes: [],
    recentGifts: [],
    recentShares: [],
    userLikeCounts: {}, // Track likes per user
    newFollowers: [], // Track new followers
    sentimentScore: 0, // Automated sentiment score
    rollingSentimentScore: 0, // Rolling average of last 100 comments
    commentSentiments: [], // Store sentiment scores for rolling average
    keywordFrequency: {}, // Track keyword mentions
    lastPromptTime: 0, // Track when last prompt was sent
    promptCooldowns: {}, // Track cooldowns for different prompt types
    viewerHistory: [], // Track viewer count over time
    
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
    }
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
    
    // Clean up any existing duplicates
    if (typeof cleanupDuplicateFollowers === 'function') {
        cleanupDuplicateFollowers();
    }
    
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
        
        // Broadcast updated metrics to dashboard if we found any data
        if (initialLikes > 0 || initialGifts > 0 || initialComments > 0 || initialViewers > 0) {
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
                    isFollower: false, // Track follower status
                    followTime: null, // When they started following
                    hasBeenWelcomed: false // Track if AI has welcomed them
                };
                metrics.viewerStats.totalUniqueViewers++;
                console.log(`👤 [VIEWER] New viewer joined: ${nickname} (${userId})`);
            } else {
                // Viewer rejoined, update last seen
                metrics.viewers[userId].lastSeen = now;
                metrics.viewers[userId].isActive = true;
                console.log(`👤 [VIEWER] Viewer rejoined: ${nickname} (${userId})`);
            }
    
    // Broadcast viewer update
    broadcastEvent('viewerUpdate', {
        type: 'join',
        viewer: metrics.viewers[userId]
    });
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
    const welcomeMessages = [
        `Hey ${nickname}! 👋 Welcome to the stream! I'm so glad you're here!`,
        `Welcome ${nickname}! 🎉 You're joining us at the perfect time!`,
        `Hi ${nickname}! ✨ Great to see you in the chat!`,
        `Welcome aboard ${nickname}! 🚀 You're going to love this stream!`,
        `Hey there ${nickname}! 🌟 So happy you joined us!`
    ];

    const engagementTips = [
        `💡 **Tip**: Ask ${nickname} about their day or interests to build connection`,
        `💡 **Tip**: Encourage ${nickname} to drop a comment or like to stay engaged`,
        `💡 **Tip**: Share something personal to make ${nickname} feel welcome`,
        `💡 **Tip**: Ask ${nickname} if they've been to any interesting places lately`,
        `💡 **Tip**: Invite ${nickname} to share their thoughts on the current topic`
    ];

    const retentionStrategies = [
        `🎯 **Retention**: With ${viewerCount} viewers, focus on personal connection`,
        `🎯 **Retention**: Early viewers like ${nickname} are your core audience`,
        `🎯 **Retention**: Build rapport with ${nickname} to increase watch time`,
        `🎯 **Retention**: Ask ${nickname} questions to keep them engaged`,
        `🎯 **Retention**: Share behind-the-scenes info to make ${nickname} feel special`
    ];

    // Select random messages
    const welcomeMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    const engagementTip = engagementTips[Math.floor(Math.random() * engagementTips.length)];
    const retentionStrategy = retentionStrategies[Math.floor(Math.random() * retentionStrategies.length)];

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
        
        // Broadcast updated metrics to dashboard
        broadcastMetrics();
        
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
            message: `🚨 [PREDICTIVE] High churn risk detected (${churnRisk.risk}%)! ${churnRisk.factors.join(', ')}`,
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
            message: `💰 [PREDICTIVE] High-value monetization opportunity (${monetizationOpportunity.opportunity}%)! ${monetizationOpportunity.factors.join(', ')}`,
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
    let totalRisk = 0;
    
    // 1. Viewer count decline trend
    if (metrics.viewerHistory.length >= 10) {
        const recentViewers = metrics.viewerHistory.slice(-10);
        const declineRate = calculateDeclineRate(recentViewers.map(v => v.count));
        if (declineRate > 0.1) { // 10% decline
            riskFactors.push(`Viewer count declining at ${(declineRate * 100).toFixed(1)}% per minute`);
            totalRisk += Math.min(declineRate * 200, 40); // Max 40 points
        }
    }
    
    // 2. Engagement drop
    const currentEngagement = (metrics.likesPerMinute + metrics.commentsPerMinute * 2) / 3;
    const avgEngagement = calculateAverageEngagement();
    if (currentEngagement < avgEngagement * 0.6) {
        riskFactors.push(`Engagement ${((avgEngagement - currentEngagement) / avgEngagement * 100).toFixed(1)}% below average`);
        totalRisk += 25;
    }
    
    // 3. Sentiment decline
    if (metrics.commentSentiments.length >= 20) {
        const recentSentiment = metrics.commentSentiments.slice(-10);
        const avgRecentSentiment = recentSentiment.reduce((a, b) => a + b, 0) / recentSentiment.length;
        const overallSentiment = metrics.rollingSentimentScore;
        if (avgRecentSentiment < overallSentiment - 1) {
            riskFactors.push(`Recent sentiment ${(overallSentiment - avgRecentSentiment).toFixed(1)} points below average`);
            totalRisk += 20;
        }
    }
    
    // 4. Chat silence
    const lastCommentTime = metrics.recentComments.length > 0 ? 
        metrics.recentComments[metrics.recentComments.length - 1].timestamp.getTime() : 0;
    const silenceDuration = (now - lastCommentTime) / 1000 / 60; // minutes
    if (silenceDuration > 3) {
        riskFactors.push(`Chat silent for ${silenceDuration.toFixed(1)} minutes`);
        totalRisk += Math.min(silenceDuration * 8, 30); // Max 30 points
    }
    
    // 5. User retention drop
    const retentionRate = calculateUserRetentionRate();
    if (retentionRate < 0.7) { // Less than 70% retention
        riskFactors.push(`User retention at ${(retentionRate * 100).toFixed(1)}%`);
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
        timeToChurn: timeToChurn
    };
}

// Monetization opportunity prediction
function predictMonetizationOpportunity() {
    const now = Date.now();
    const opportunityFactors = [];
    let totalOpportunity = 0;
    
    // 1. High engagement moment
    const currentEngagement = (metrics.likesPerMinute + metrics.commentsPerMinute * 2) / 3;
    const avgEngagement = calculateAverageEngagement();
    if (currentEngagement > avgEngagement * 1.5) {
        opportunityFactors.push(`Engagement ${((currentEngagement - avgEngagement) / avgEngagement * 100).toFixed(1)}% above average`);
        totalOpportunity += 30;
    }
    
    // 2. Positive sentiment spike
    if (metrics.commentSentiments.length >= 10) {
        const recentSentiment = metrics.commentSentiments.slice(-5);
        const avgRecentSentiment = recentSentiment.reduce((a, b) => a + b, 0) / recentSentiment.length;
        if (avgRecentSentiment > 1.5) {
            opportunityFactors.push(`Very positive sentiment (${avgRecentSentiment.toFixed(1)})`);
            totalOpportunity += 25;
        }
    }
    
    // 3. Gift correlation patterns
    const giftCorrelation = analyzeGiftCorrelation();
    if (giftCorrelation.correlation > 0.7) {
        opportunityFactors.push(`Strong gift correlation with current content`);
        totalOpportunity += 20;
    }
    
    // 4. Viewer count stability/growth
    if (metrics.viewerHistory.length >= 5) {
        const recentViewers = metrics.viewerHistory.slice(-5);
        const growthRate = calculateGrowthRate(recentViewers.map(v => v.count));
        if (growthRate > 0.05) { // 5% growth
            opportunityFactors.push(`Viewer count growing at ${(growthRate * 100).toFixed(1)}% per minute`);
            totalOpportunity += 15;
        }
    }
    
    // 5. Content performance history
    const contentPerformance = analyzeContentPerformance();
    if (contentPerformance.score > 0.8) {
        opportunityFactors.push(`Current content type historically performs well`);
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

// Enhanced AI prompt generation with intelligent analysis
function generateAutomatedPrompt() {
    const now = Date.now();
    const prompts = [];
    
    // Reduce cooldown for testing - minimum 1 minute cooldown instead of 2
    if (now - metrics.lastPromptTime < 60000) {
        console.log(`🤖 [COOLDOWN] Still on cooldown. Last prompt: ${Math.round((now - metrics.lastPromptTime) / 1000)}s ago`);
        return null;
    }
    
    console.log(`🤖 [AI ANALYSIS] Starting prompt generation analysis...`);
    
    // 0. PREDICTIVE ANALYTICS (NEW - HIGHEST PRIORITY)
    const predictiveInsights = runPredictiveAnalytics();
    if (predictiveInsights.churnRisk) {
        console.log(`🚨 [PREDICTIVE] High churn risk detected: ${predictiveInsights.churnRisk.score}`);
        prompts.push(predictiveInsights.churnRisk);
    }
    if (predictiveInsights.monetizationOpportunity) {
        console.log(`💰 [PREDICTIVE] Monetization opportunity detected: ${predictiveInsights.monetizationOpportunity.score}`);
        prompts.push(predictiveInsights.monetizationOpportunity);
    }
    
    // 1. ENGAGEMENT PATTERN ANALYSIS
    const engagementTrend = analyzeEngagementTrend();
    console.log(`🤖 [ENGAGEMENT] Trend analysis: ${engagementTrend}`);
    if (engagementTrend === 'declining') {
        const currentViewers = metrics.currentViewerCount || 0;
        const likeRate = metrics.likesPerMinute || 0;
        
        if (currentViewers > 800 && likeRate < 30) {
            prompts.push({
                type: 'engagement',
                priority: 'high',
                message: '📉 High viewer count but low engagement. Try: "I see lots of you watching! What\'s something interesting that happened today?" or "Anyone want to share a funny story?"',
                trigger: 'high_viewers_low_engagement',
                action: 'activate_lurkers'
            });
        } else {
            prompts.push({
                type: 'engagement',
                priority: 'high',
                message: '📉 Chat seems quieter than usual. Try asking: "What\'s on your mind?" or "Anyone want to share a story?"',
                trigger: 'engagement_decline',
                action: 'ask_open_question'
            });
        }
    } else if (engagementTrend === 'increasing') {
        const currentViewers = metrics.currentViewerCount || 0;
        const likeRate = metrics.likesPerMinute || 0;
        
        if (likeRate > 80) {
            prompts.push({
                type: 'momentum',
                priority: 'high',
                message: '🚀 Like explosion! Something is resonating with chat - keep doing what you\'re doing! Consider: "This energy is amazing! What\'s got everyone so excited?"',
                trigger: 'like_explosion',
                action: 'capitalize_momentum'
            });
        } else {
            prompts.push({
                type: 'momentum',
                priority: 'medium',
                message: '📈 Engagement is picking up! Try: "I love this energy! What\'s something positive that happened to you recently?"',
                trigger: 'engagement_increase',
                action: 'maintain_momentum'
            });
        }
    }
    
    // 2. SENTIMENT INTELLIGENCE
    const sentimentInsight = analyzeSentimentIntelligence();
    if (sentimentInsight) {
        console.log(`🤖 [SENTIMENT] Sentiment insight generated`);
        prompts.push(sentimentInsight);
    }
    
    // 3. CONTENT OPPORTUNITY DETECTION
    const contentOpportunity = detectContentOpportunities();
    if (contentOpportunity) {
        console.log(`🤖 [CONTENT] Content opportunity detected`);
        prompts.push(contentOpportunity);
    }
    
    // 4. VIEWER INTERACTION PATTERNS
    const interactionPattern = analyzeViewerInteractions();
    if (interactionPattern) {
        console.log(`🤖 [INTERACTION] Interaction pattern detected`);
        prompts.push(interactionPattern);
    }
    
    // 5. STREAM HEALTH MONITORING
    const streamHealth = monitorStreamHealth();
    if (streamHealth) {
        console.log(`🤖 [HEALTH] Stream health issue detected`);
        prompts.push(streamHealth);
    }
    
    // 6. SMART CONTENT SUGGESTIONS (if no other prompts generated)
    if (prompts.length === 0 && metrics.totalComments > 10) {
        console.log(`🤖 [SMART] No prompts generated, creating intelligent content suggestion`);
        
        // Analyze current stream context for better suggestions
        const viewerCount = metrics.currentViewerCount || 0;
        const likeRate = metrics.likesPerMinute || 0;
        const commentRate = metrics.commentsPerMinute || 0;
        
        if (viewerCount > 1000 && likeRate > 50) {
            prompts.push({
                type: 'content',
                priority: 'high',
                message: '🔥 Stream is on fire! Viewers are super engaged. Try: "What\'s the most exciting thing that happened to you this week?" or "Let\'s play a game - what\'s your favorite [topic]?"',
                trigger: 'high_engagement',
                action: 'leverage_momentum'
            });
        } else if (commentRate > 20) {
            prompts.push({
                type: 'interaction',
                priority: 'medium',
                message: '💬 Chat is buzzing with conversation! Ask: "What\'s the most interesting thing someone said in chat today?" or "Who has the best story to share right now?"',
                trigger: 'active_chat',
                action: 'facilitate_discussion'
            });
        } else if (viewerCount > 500) {
            prompts.push({
                type: 'engagement',
                priority: 'medium',
                message: '👥 Good viewer count but chat could be livelier. Try: "What\'s something that made you laugh today?" or "Anyone want to share a win or achievement?"',
                trigger: 'moderate_engagement',
                action: 'boost_interaction'
            });
        } else {
            prompts.push({
                type: 'growth',
                priority: 'medium',
                message: '📈 Building the community! Ask: "What brought you to this stream today?" or "What kind of content do you enjoy most?"',
                trigger: 'community_building',
                action: 'understand_audience'
            });
        }
    }
    
    console.log(`🤖 [PROMPTS] Generated ${prompts.length} potential prompts`);
    
    // Return highest priority prompt with smart selection
    return selectBestPrompt(prompts);
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
    const avgSentiment = recentSentiments.reduce((a, b) => a + b, 0) / recentSentiments.length;
    const sentimentVariance = calculateVariance(recentSentiments);
    
    // Detect specific sentiment patterns
    if (avgSentiment < -0.5 && sentimentVariance < 2) {
        const currentViewers = metrics.currentViewerCount || 0;
        
        if (currentViewers > 1000) {
            return {
                type: 'sentiment',
                priority: 'high',
                message: '😔 Large audience but chat mood is down. Try: "I feel like we need some positive energy! What\'s something that always makes you smile?" or "Let\'s share some good news - what\'s something great that happened this week?"',
                trigger: 'large_audience_negative_mood',
                action: 'mood_transformation'
            };
        } else {
            return {
                type: 'sentiment',
                priority: 'high',
                message: '😔 Chat seems down. Try: "Let\'s turn this around! What\'s something positive that happened today?"',
                trigger: 'sustained_negative',
                action: 'positive_redirection'
            };
        }
    }
    
    if (avgSentiment > 1.5 && sentimentVariance > 3) {
        const currentViewers = metrics.currentViewerCount || 0;
        const likeRate = metrics.likesPerMinute || 0;
        
        if (currentViewers > 800 && likeRate > 40) {
            return {
                type: 'sentiment',
                priority: 'high',
                message: '🎉 Amazing energy! High viewers and engagement. Try: "This vibe is incredible! What\'s the most exciting thing you\'re looking forward to?" or "Let\'s play a game - what\'s your favorite [topic] and why?"',
                trigger: 'high_positive_energy_high_engagement',
                action: 'leverage_peak_momentum'
            };
        } else {
            return {
                type: 'sentiment',
                priority: 'medium',
                message: '🎉 Great vibes in chat! Capitalize on this energy - ask for game suggestions or share a win!',
                trigger: 'high_positive_energy',
                action: 'leverage_positive_mood'
            };
        }
    }
    
    // Detect sentiment swings (controversial topics)
    if (sentimentVariance > 5) {
        return {
            type: 'sentiment',
            priority: 'medium',
            message: '⚡ Chat is divided on this topic. Consider: "Let\'s hear both sides - what do you think?"',
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
            message: `🎮 "${topKeyword.keyword}" is hot right now! Consider: "Should we play ${topKeyword.keyword} next?" or "What's your best ${topKeyword.keyword} tip?"`,
            trigger: 'game_trend',
            action: 'game_suggestion',
            keyword: topKeyword.keyword
        };
    }
    
    if (topKeyword.context === 'personal') {
        return {
            type: 'content',
            priority: 'medium',
            message: `👤 Chat is curious about "${topKeyword.keyword}"! Share a story or ask: "What's your experience with ${topKeyword.keyword}?"`,
            trigger: 'personal_interest',
            action: 'share_personal',
            keyword: topKeyword.keyword
        };
    }
    
    return {
        type: 'content',
        priority: 'medium',
        message: `💡 "${topKeyword.keyword}" is getting attention! "What should we discuss about ${topKeyword.keyword}?"`,
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
            return {
                type: 'health',
                priority: 'high',
                message: '🔇 Chat has been quiet for a while. Try asking: "Anyone still here? Drop a comment!" or "What should we do next?"',
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
                message: '📊 Viewer retention could be better. Try: "What would make you stay longer?" or "Should we change things up?"',
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
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    // Check cooldowns for specific trigger types
    const availablePrompts = sortedPrompts.filter(prompt => {
        const lastTriggered = metrics.promptCooldowns?.[prompt.trigger] || 0;
        const cooldown = getCooldownForTrigger(prompt.trigger);
        return (now - lastTriggered) > cooldown;
    });
    
    if (availablePrompts.length === 0) return null;
    
    const selectedPrompt = availablePrompts[0];
    
    // Update cooldown tracking
    if (!metrics.promptCooldowns) metrics.promptCooldowns = {};
    metrics.promptCooldowns[selectedPrompt.trigger] = now;
    metrics.lastPromptTime = now;
    
    return selectedPrompt;
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
        'default': 180000                  // 3 minutes
    };
    
    return cooldowns[trigger] || cooldowns.default;
}

// Additional helper functions for the AI system
function detectNewViewers() {
    // This would require tracking viewer history over time
    // For now, return null to avoid complexity
    return null;
}

function analyzeLikePatterns() {
    if (metrics.likesPerMinute < 5 && metrics.totalLikes > 100) {
        return {
            type: 'engagement',
            priority: 'medium',
            message: '❤️ Like engagement is low. Try: "Drop a like if you\'re enjoying the stream!" or "Show some love chat!"',
            trigger: 'low_likes',
            action: 'encourage_likes'
        };
    }
    
    // Detect like spikes (viral moments)
    if (metrics.likesPerMinute > 50) {
        return {
            type: 'engagement',
            priority: 'medium',
            message: '🚀 Like explosion! Something is resonating with chat - keep doing what you\'re doing!',
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
            message: `🎉 ${metrics.currentViewerCount.toLocaleString()} viewers! Amazing milestone! Consider: "We\'re growing fast! What brought you here today?"`,
            trigger: 'viewer_milestone',
            action: 'celebrate_milestone'
        };
    }
    
    return null;
}

function detectRecurringThemes() {
    // This would require more sophisticated text analysis
    // For now, return null to avoid complexity
    return null;
}

function detectViralMoment() {
    // This would require detecting rapid engagement spikes
    // For now, return null to avoid complexity
    return null;
}

function calculateRetentionRate() {
    // This would require tracking viewer entry/exit times
    // For now, return a default value to avoid complexity
    return 0.8;
}

// Helper function to extract user information
function getUserInfo(data) {
    return {
        userId: data.uniqueId || data.userId || data.user?.uniqueId || data.user?.userId || 'Unknown',
        nickname: data.nickname || data.user?.nickname || data.user?.displayName || data.displayName || 'Unknown'
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

// Update per-minute metrics
function updatePerMinuteMetrics() {
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
    metrics.commentsPerMinute = commentsInLastMinute.length;
    metrics.sharesPerMinute = sharesInLastMinute.length;
    metrics.followersGainsPerMinute = followersGainedInLastMinute.length;
    metrics.lastUpdate = new Date();
    
    // Update entertainment level when engagement metrics change
    calculateEntertainmentLevel();
    
    // Broadcast updated metrics to all connected clients
    broadcastMetrics();
}

// Broadcast metrics to all connected WebSocket clients
function broadcastMetrics() {
    // Create a clean metrics object for broadcasting
    const metricsData = {
        currentViewerCount: metrics.currentViewerCount,
        
        // Cumulative totals (all-time)
        totalLikes: metrics.totalLikes,
        totalGifts: metrics.totalGifts,
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

// Handle WebSocket messages from dashboard
wss.on('connection', (ws) => {
    console.log('🖥️  Dashboard connected via WebSocket');
    console.log(`📊 Total connected clients: ${wss.clients.size}`);
    
    // Send initial metrics
    broadcastEvent('metrics', {
        currentViewerCount: metrics.currentViewerCount,
        totalLikes: metrics.totalLikes,
        totalGifts: metrics.totalGifts,
        totalComments: metrics.totalComments,
        likesPerMinute: metrics.likesPerMinute,
        giftsPerMinute: metrics.giftsPerMinute,
        commentsPerMinute: metrics.commentsPerMinute,
        sentimentScore: metrics.sentimentScore,
        rollingSentimentScore: metrics.rollingSentimentScore,
        keywordFrequency: metrics.keywordFrequency,
        userLikeCounts: metrics.userLikeCounts,
        viewerStats: {
            totalUniqueViewers: metrics.viewerStats.totalUniqueViewers,
            averageWatchTime: metrics.viewerStats.averageWatchTime,
            longestWatchTime: metrics.viewerStats.longestWatchTime,
            viewersByWatchTime: metrics.viewerStats.viewersByWatchTime,
            activeViewers: Object.values(metrics.viewers).filter(v => v.isActive).length
        },
        newFollowers: metrics.newFollowers || [],
        sessionFollowersGained: metrics.sessionFollowersGained || 0,
        entertainmentMetrics: {
            entertainmentScore: metrics.entertainmentMetrics.entertainmentScore,
            engagementIntensity: metrics.entertainmentMetrics.engagementIntensity,
            contentReception: metrics.entertainmentMetrics.contentReception,
            audienceEnergy: metrics.entertainmentMetrics.audienceEnergy,
            retentionQuality: metrics.entertainmentMetrics.retentionQuality
        },
        questionDetection: {
            pendingQuestions: metrics.questionDetection.pendingQuestions.slice(-5),
            questionStats: metrics.questionDetection.questionStats
        },
        predictiveMetrics: {
            churnRiskScore: metrics.predictiveMetrics.churnRiskScore,
            monetizationOpportunityScore: metrics.predictiveMetrics.monetizationOpportunityScore,
            engagementTrend: metrics.predictiveMetrics.engagementTrend,
            viewerRetentionRate: metrics.predictiveMetrics.viewerRetentionRate,
            sentimentVolatility: metrics.predictiveMetrics.sentimentVolatility
        },
        timestamp: new Date()
    });
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'test') {
                // Remove debug output - just log internally
                console.log('📨 Received test message from dashboard');
                // Don't send response back - this was causing confusion
            } else if (data.type === 'changeUsername') {
                console.log('🔄 [USERNAME] Username change request:', data.username);
                changeTikTokUsername(data.username, ws);
            } else if (data.type === 'disconnectStream') {
                console.log('❌ [USERNAME] Disconnect stream request');
                disconnectFromTikTok(ws);
            }
        } catch (error) {
            console.error('❌ Error parsing dashboard message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🖥️  Dashboard disconnected');
        console.log(`📊 Total connected clients: ${wss.clients.size}`);
    });
    
    ws.on('error', (error) => {
        console.error('❌ Dashboard WebSocket error:', error);
    });
});

// TikTok Live connection with reconnection logic
let connection = null;
let isConnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 5000; // 5 seconds

// Function to change TikTok username dynamically
async function changeTikTokUsername(newUsername, ws) {
    try {
        console.log(`🔄 [USERNAME] Changing from ${TIKTOK_USERNAME} to ${newUsername}`);
        
        // Validate username
        if (!newUsername || newUsername.trim() === '') {
            throw new Error('Username cannot be empty');
        }
        
        // Disconnect current connection if exists
        if (connection) {
            console.log('🔌 [USERNAME] Disconnecting current TikTok connection...');
            try {
                connection.disconnect();
            } catch (disconnectError) {
                console.log('⚠️ [USERNAME] Error during disconnect (continuing):', disconnectError.message);
            }
            connection = null;
        }
        
        // Update username variable
        TIKTOK_USERNAME = newUsername;
        console.log(`✅ [USERNAME] Username updated to: ${TIKTOK_USERNAME}`);
        
        // Reset metrics for new stream
        resetSessionMetrics();
        
        // Notify dashboard of username change
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'usernameChanged',
                username: newUsername,
                message: `Switched to @${newUsername}`
            }));
            console.log('📤 [USERNAME] Sent usernameChanged message to dashboard');
        }
        
        // Connect to new username
        console.log('🔗 [USERNAME] Starting connection to new username...');
        
        // Send progress update
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'connectionProgress',
                username: newUsername,
                message: 'Connecting to TikTok Live...',
                progress: 25
            }));
        }
        
        await connectToTikTok();
        
        // Send success message after connection
        console.log('✅ [USERNAME] Successfully connected to new username');
        if (ws && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'usernameChanged',
                username: newUsername,
                message: `Successfully connected to @${newUsername}`,
                status: 'success'
            }));
        }
        
    } catch (error) {
        console.error('❌ [USERNAME] Error changing username:', error);
        console.error('❌ [USERNAME] Error stack:', error.stack);
        
        // Send detailed error to dashboard
        if (ws && ws.readyState === ws.OPEN) {
            const errorMessage = {
                type: 'usernameChangeError',
                error: error.message || 'Unknown error occurred',
                details: error.toString(),
                stack: error.stack
            };
            
            console.log('📤 [USERNAME] Sending error message to dashboard:', errorMessage);
            ws.send(JSON.stringify(errorMessage));
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

let TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || "kameltoetonybu"; // Make configurable via env

async function connectToTikTok() {
    if (isConnecting) return;
    
    isConnecting = true;
    console.log(`🔗 [CONNECTION] Attempting to connect to TikTok Live: ${TIKTOK_USERNAME}`);
    
    try {
        connection = new WebcastPushConnection(TIKTOK_USERNAME, {
            requestPollingIntervalMs: 2000,
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
                "heartbeatIntervalMs": 10000,
                "client": "web"
            }
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
        });

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
                
                // Perform sentiment analysis
                const sentimentResult = sentiment.analyze(cleanedComment);
                const sentimentScore = sentimentResult.score;
                
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
                    const automatedPrompt = generateAutomatedPrompt();
                    if (automatedPrompt) {
                        console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                        broadcastEvent('automatedPrompt', automatedPrompt);
                    } else {
                        console.log(`🤖 [AI CHECK] No prompts triggered at this time`);
                    }
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
            
            // Track viewer activity for watch time and update viewer's diamond count
            if (userId && metrics.viewers[userId]) {
                updateViewerActivity(userId, 'gift');
                // Update viewer's total diamonds spent
                metrics.viewers[userId].totalDiamonds += totalDiamonds;
                
                // Check and update follower status
                checkAndUpdateFollowerStatus(userId, data);
            }
            
            // Add to total gifts earned
            metrics.totalGifts += totalDiamonds;
            giftsInLastMinute.push(Date.now());
            
            console.log(`🎁 [GIFT] ${nickname} sent ${gift.name} (${totalDiamonds} diamonds total)`);
            
            const giftData = {
                userId,
                nickname,
                profilePic: data.profilePictureUrl || data.user?.avatarThumb?.urlList?.[0] || data.userDetails?.profilePictureUrls?.[0] || null,
                gift: gift,
                timestamp: new Date(),
                diamondCount: totalDiamonds
            };
            
            metrics.recentGifts.unshift(giftData);
            if (metrics.recentGifts.length > 20) {
                metrics.recentGifts = metrics.recentGifts.slice(0, 20);
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
                
                // Use the centralized function to add new follower
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
                const automatedPrompt = generateAutomatedPrompt();
                if (automatedPrompt) {
                    console.log(`🤖 [AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
                    broadcastEvent('automatedPrompt', automatedPrompt);
                }
            }
        });



        // Helper function to check if user is a follower
        function checkAndUpdateFollowerStatus(userId, data) {
            if (!userId || !metrics.viewers[userId]) return;
            
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

        // AI Welcome System for New Viewers
        connection.on('member', (data) => {
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
                // Add viewer to tracking
                addViewer(userId, nickname, profilePic);
                
                // Check and update follower status
                checkAndUpdateFollowerStatus(userId, data);
                
                // Check if this is a new viewer during stream start (1-10 viewers)
                if (metrics.currentViewerCount >= 1 && metrics.currentViewerCount <= 10) {
                    // Check if this is a new viewer (not rejoining)
                    const viewer = metrics.viewers[userId];
                    if (viewer && !viewer.hasBeenWelcomed) {
                        viewer.hasBeenWelcomed = true;
                        
                        // Generate AI welcome message and tips
                        const welcomeData = generateAIWelcome(nickname, metrics.currentViewerCount);
                        
                        console.log(`🤖 [AI WELCOME] New viewer: ${nickname} | Welcome: ${welcomeData.welcomeMessage}`);
                        console.log(`💡 [AI TIPS] Engagement tips: ${welcomeData.engagementTips}`);
                        
                        // Broadcast AI welcome event
                        broadcastEvent('aiWelcome', {
                            viewer: { userId, nickname, profilePic },
                            welcomeMessage: welcomeData.welcomeMessage,
                            engagementTips: welcomeData.engagementTips,
                            viewerCount: metrics.currentViewerCount,
                            timestamp: new Date()
                        });
                    }
                }
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
                        // Try to extract room state from this data
                        extractInitialRoomState(data);
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

        connection.on('member', (data) => {
            console.log('🎯 [MEMBER] Member event received:', data);
            console.log('🎯 [MEMBER] Data structure:', JSON.stringify(data, null, 2));
            
            // Track viewer watch time - extract user info from member event
            if (data.userId && data.nickname) {
                const profilePic = data.user?.avatarThumb?.urlList?.[0] || null;
                addViewer(data.userId, data.nickname, profilePic);
                console.log(`👤 [MEMBER] Added viewer: ${data.nickname} (${data.userId})`);
            } else {
                console.log('⚠️ [MEMBER] Missing userId or nickname:', { userId: data.userId, nickname: data.nickname });
            }
            
            // Check if this contains room totals
            if (data.roomStats || data.totalLikes || data.totalGifts) {
                extractInitialRoomState(data);
            }
        });

        connection.on('join', (data) => {
            console.log('🎯 [JOIN] Join event received:', data);
            console.log('🎯 [JOIN] Data structure:', JSON.stringify(data, null, 2));
            
            // Track viewer watch time - extract user info from join event
            if (data.userId && data.nickname) {
                const profilePic = data.user?.avatarThumb?.urlList?.[0] || null;
                addViewer(data.userId, data.nickname, profilePic);
                console.log(`👤 [JOIN] Added viewer: ${data.nickname} (${data.userId})`);
            } else {
                console.log('⚠️ [JOIN] Missing userId or nickname:', { userId: data.userId, nickname: data.nickName });
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

// Start the TikTok Live connection
const username = "camyslive"; // TODO: Make this configurable
console.log("🎯 TikTok Live Data Processor Starting...");
console.log(`📡 Connecting to: @${username}`);
console.log("🖥️  Dashboard will be available at: http://localhost:3000");
console.log("🔌 WebSocket endpoint: ws://localhost:3000");
console.log("=" .repeat(60));

// Set up periodic metrics updates
setInterval(updatePerMinuteMetrics, 1000); // Update every second

// Set up periodic AI prompt checks
setInterval(() => {
    console.log(`🤖 [PERIODIC AI CHECK] Checking for automated prompts...`);
    const automatedPrompt = generateAutomatedPrompt();
    if (automatedPrompt) {
        console.log(`🤖 [PERIODIC AUTO-PROMPT] ${automatedPrompt.message} (Trigger: ${automatedPrompt.trigger})`);
        broadcastEvent('automatedPrompt', automatedPrompt);
    }
}, 30000); // Check every 30 seconds

// Set up periodic viewer watch time updates
setInterval(() => {
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

// Note: Removed periodic room info fetching to restore original behavior
// Historical data is now fetched once before connection and broadcasted immediately

// Start the TikTok connection
connectToTikTok();





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
        totalComments: metrics.totalComments,
        currentViewerCount: metrics.currentViewerCount,
        sessionFollowersGained: metrics.sessionFollowersGained
    });
});

// Serve dashboard
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/dashboard.html');
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Server is running!', timestamp: new Date().toISOString() });
});

// Debug endpoint to check current metrics
app.get('/debug', (req, res) => {
    res.json({
        message: 'Current metrics and status',
        metrics: metrics,
        connectedClients: wss.clients.size,
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

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    
    console.log(`📊 Metrics API: http://localhost:${PORT}/metrics`);
    
    // Clean up any existing duplicates on server startup
    cleanupDuplicateFollowers();
    
    console.log("=" .repeat(60));
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
    
    // Broadcast updated metrics to dashboard
    broadcastMetrics();
    console.log('✅ [MANUAL OVERRIDE] Room totals updated and broadcasted');
}

// Make manual override function available globally for testing
global.setCurrentRoomTotals = setCurrentRoomTotals;

            
