#!/usr/bin/env node
/**
 * TikTok Live Data Ingestion Test
 * Using TikTok-Live-Connector library
 * 
 * This script tests the core functionality needed for the Live Assistant MVP:
 * - Connection to TikTok Live streams
 * - Real-time comment capture
 * - Like event monitoring
 * - Gift event tracking
 * 
 * Usage:
 * 1. Install dependencies: npm install
 * 2. Find a currently live TikTok streamer
 * 3. Replace 'YOUR_TIKTOK_USERNAME' with the streamer's username
 * 4. Run: node tiktok_live_test.js
 */

const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

async function runTest() {
    console.log("🎵 TikTok Live Data Ingestion Test");
    console.log("==================================================");
    
    // TODO: Replace with a currently live TikTok streamer's username
    // You can find live streamers by going to TikTok app > Live tab
    // Some popular streamers to try: 'ttvmedzn', 'tiktoklive_us', 'officialtiktok'
    const username = "lanocallum1";
    
    console.log(`Attempting to connect to: @${username}`);
    console.log("Make sure this streamer is currently live on TikTok!");
    console.log("💡 TIP: To find live streamers, open TikTok app > Live tab");
    console.log("💡 TIP: Try different usernames if this one isn't live");
    console.log("-" .repeat(50));
    
    // Display all events being monitored
    console.log("📋 MONITORING THE FOLLOWING EVENTS:");
    console.log("💬 CHAT - Comments and messages");
    console.log("❤️ LIKE - User likes and reactions");
    console.log("🎁 GIFT - Virtual gifts and donations");
    console.log("👋 FOLLOW - New followers");
    console.log("📤 SHARE - Stream shares");
    console.log("👋 JOIN - User joins");
    console.log("⭐ SUBSCRIBE - New subscribers");
    console.log("👥 ROOM_USER - Viewer count updates");
    console.log("👤 MEMBER - Member updates");
    console.log("🔗 SOCIAL - Social interactions");
    console.log("💰 ENVELOPE - Money envelopes");
    console.log("❓ QUESTIONNAIRE - Polls and questions");
    console.log("⚔️ LINKMIC_BATTLE - Battle events");
    console.log("🏆 LINKMIC_ARMIES - Battle armies");
    console.log("🎖️ LINKMIC_CONTRIBUTOR - Battle contributors");
    console.log("🎬 LIVE_INTRO - Stream introductions");
    console.log("🔚 STREAM_END - Stream ending");
    console.log("😄 EMOTE - User emotes");
    console.log("🎯 GOAL_UPDATE - Stream goals");
    console.log("📢 ROOM_MESSAGE - Room announcements");
    console.log("📝 CAPTION_MESSAGE - Captions");
    console.log("🗑️ IM_DELETE - Message deletions");
    console.log("🏷️ IN_ROOM_BANNER - Banner updates");
    console.log("🏅 RANK_UPDATE - Rank changes");
    console.log("📊 POLL_MESSAGE - Polls");
    console.log("📜 RANK_TEXT - Rank text");
    console.log("⚖️ LINK_MIC_BATTLE_PUNISH_FINISH - Battle punishments");
    console.log("📋 LINK_MIC_BATTLE_TASK - Battle tasks");
    console.log("🎫 LINK_MIC_FAN_TICKET_METHOD - Fan ticket methods");
    console.log("🔗 LINK_MIC_METHOD - Link mic methods");
    console.log("🚫 UNAUTHORIZED_MEMBER - Unauthorized access");
    console.log("🛍️ OEC_LIVE_SHOPPING - Live shopping");
    console.log("🔍 MSG_DETECT - Message detection");
    console.log("🔗 LINK_MESSAGE - Link messages");
    console.log("✅ ROOM_VERIFY - Room verification");
    console.log("🔗 LINK_LAYER - Link layers");
    console.log("📌 ROOM_PIN - Room pins");
    console.log("-" .repeat(50));
    
    // Create the connection instance
    const connection = new TikTokLiveConnection(username);
    
    // Track events
    let eventsReceived = 0;
    const startTime = Date.now();
    
    // Helper function to safely get user info
    function getUserInfo(data) {
        // Try different possible field names for user information
        const userId = data.uniqueId || data.userId || data.user?.uniqueId || data.user?.userId || 'Unknown User';
        const nickname = data.nickname || data.user?.nickname || data.user?.displayName || data.displayName || 'Unknown Nickname';
        
        return { userId, nickname };
    }
    
    // Helper function to extract gift information from various data structures
    function getGiftInfo(data) {
        // Try to find gift information in different possible locations
        let giftInfo = {
            name: 'Unknown Gift',
            id: 'Unknown',
            type: 'Unknown',
            diamondCount: 'Unknown',
            image: 'No image',
            repeatCount: 1
        };
        
        // Direct properties
        if (data.giftName) giftInfo.name = data.giftName;
        if (data.giftId) giftInfo.id = data.giftId;
        if (data.giftType) giftInfo.type = data.giftType;
        if (data.diamondCount) giftInfo.diamondCount = data.diamondCount;
        if (data.giftImage) giftInfo.image = data.giftImage;
        if (data.repeatCount) giftInfo.repeatCount = data.repeatCount;
        
        // Nested gift object
        if (data.gift) {
            if (data.gift.name) giftInfo.name = data.gift.name;
            if (data.gift.id) giftInfo.id = data.gift.id;
            if (data.gift.type) giftInfo.type = data.gift.type;
            if (data.gift.diamondCount) giftInfo.diamondCount = data.gift.diamondCount;
            if (data.gift.image) giftInfo.image = data.gift.image;
            if (data.gift.repeatCount) giftInfo.repeatCount = data.gift.repeatCount;
        }
        
        // Nested giftInfo object
        if (data.giftInfo) {
            if (data.giftInfo.name) giftInfo.name = data.giftInfo.name;
            if (data.giftInfo.id) giftInfo.id = data.giftInfo.id;
            if (data.giftInfo.type) giftInfo.type = data.giftInfo.type;
            if (data.giftInfo.diamondCount) giftInfo.diamondCount = data.giftInfo.diamondCount;
            if (data.giftInfo.image) giftInfo.image = data.giftInfo.image;
            if (data.giftInfo.repeatCount) giftInfo.repeatCount = data.giftInfo.repeatCount;
        }
        
        // Alternative field names
        if (data.coins && giftInfo.diamondCount === 'Unknown') giftInfo.diamondCount = data.coins;
        if (data.giftName && giftInfo.name === 'Unknown Gift') giftInfo.name = data.giftName;
        if (data.giftId && giftInfo.id === 'Unknown') giftInfo.id = data.giftId;
        
        return giftInfo;
    }
    
    // ----- Event Listeners -----
    
    // Connection events
    connection.on(WebcastEvent.CONNECTED, () => {
        eventsReceived++;
        console.log(`✅ [CONNECT #${eventsReceived}] SUCCESS! Connected to TikTok Live: @${username}`);
        console.log("-" .repeat(50));
    });
    
    connection.on(WebcastEvent.DISCONNECTED, () => {
        eventsReceived++;
        console.log(`❌ [DISCONNECT #${eventsReceived}] Disconnected from TikTok Live`);
        console.log("-" .repeat(30));
    });
    
    // Chat and engagement events
    connection.on(WebcastEvent.CHAT, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`💬 [COMMENT #${eventsReceived}] NEW COMMENT!`);
        console.log(`💬 User ID: ${userId}`);
        console.log(`💬 Nickname: ${nickname}`);
        console.log(`💬 Comment: ${data.comment || 'No comment text'}`);
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LIKE, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`❤️ [LIKE #${eventsReceived}] NEW LIKE!`);
        console.log(`❤️ User ID: ${userId}`);
        console.log(`❤️ Nickname: ${nickname}`);
        console.log(`❤️ Total Likes: ${data.totalLikeCount || 'Unknown'}`);
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.GIFT, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        const gift = getGiftInfo(data);
        
        console.log(`🎁 [GIFT #${eventsReceived}] NEW GIFT!`);
        console.log(`🎁 User ID: ${userId}`);
        console.log(`🎁 Nickname: ${nickname}`);
        console.log(`🎁 Gift: ${gift.name}`);
        console.log(`🎁 Gift ID: ${gift.id}`);
        console.log(`🎁 Gift Type: ${gift.type}`);
        console.log(`🎁 Value: ${gift.diamondCount} diamonds`);
        console.log(`🎁 Gift Image: ${gift.image}`);
        
        if (gift.repeatCount > 1) {
            console.log(`🎁 Streak: x${gift.repeatCount}`);
        }
        
        // Debug: Log raw gift data structure for ALL gifts to understand the data format
        console.log(`🔍 [DEBUG] Raw GIFT data structure for Gift ID ${gift.id}:`);
        console.log(JSON.stringify(data, null, 2));
        console.log("🔍 [DEBUG] Available top-level keys:", Object.keys(data));
        if (data.gift) {
            console.log("🔍 [DEBUG] Gift object keys:", Object.keys(data.gift));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.FOLLOW, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`👋 [FOLLOW #${eventsReceived}] NEW FOLLOWER!`);
        console.log(`👋 User ID: ${userId}`);
        console.log(`👋 Nickname: ${nickname}`);
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.SHARE, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`📤 [SHARE #${eventsReceived}] STREAM SHARED!`);
        console.log(`📤 User ID: ${userId}`);
        console.log(`📤 Nickname: ${nickname}`);
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.JOIN, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`👋 [JOIN #${eventsReceived}] USER JOINED!`);
        console.log(`👋 User ID: ${userId}`);
        console.log(`👋 Nickname: ${nickname}`);
        console.log("-" .repeat(30));
    });
    
    // Additional useful events
    connection.on(WebcastEvent.SUBSCRIBE, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`⭐ [SUBSCRIBE #${eventsReceived}] NEW SUBSCRIBER!`);
        console.log(`⭐ User ID: ${userId}`);
        console.log(`⭐ Nickname: ${nickname}`);
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.ROOM_USER, (data) => {
        eventsReceived++;
        console.log(`👥 [ROOM_USER #${eventsReceived}] ROOM UPDATE!`);
        console.log(`👥 Viewer Count: ${data.viewerCount || 'Unknown'}`);
        
        // Try different possible field names for total user count
        const totalUserCount = data.totalUserCount || data.totalUser || data.totalCount || data.userCount || data.memberCount || 'Unknown';
        console.log(`👥 Total User Count: ${totalUserCount}`);
        
        // Debug: Log the raw data structure for ROOM_USER events to understand the format
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw ROOM_USER data structure:`);
            console.log(JSON.stringify(data, null, 2));
            console.log("-" .repeat(30));
        }
    });
    
    // Error handling
    connection.on(WebcastEvent.ERROR, (error) => {
        console.log(`❌ [ERROR] Connection error: ${error}`);
        console.log("-" .repeat(30));
    });
    
    // Additional events with more comprehensive data capture
    connection.on(WebcastEvent.MEMBER, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`👤 [MEMBER #${eventsReceived}] MEMBER UPDATE!`);
        console.log(`👤 User ID: ${userId}`);
        console.log(`👤 Nickname: ${nickname}`);
        console.log(`👤 Action: ${data.action || 'Unknown'}`);
        console.log(`👤 Member Level: ${data.memberLevel || 'Unknown'}`);
        
        // Debug: Log raw MEMBER data structure for first few events
        if (eventsReceived <= 5) {
            console.log(`🔍 [DEBUG] Raw MEMBER data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.SOCIAL, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`🔗 [SOCIAL #${eventsReceived}] SOCIAL UPDATE!`);
        console.log(`🔗 User ID: ${userId}`);
        console.log(`🔗 Nickname: ${nickname}`);
        console.log(`🔗 Action: ${data.action || 'Unknown'}`);
        console.log(`🔗 Display Type: ${data.displayType || 'Unknown'}`);
        
        // Debug: Log raw SOCIAL data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw SOCIAL data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.ENVELOPE, (data) => {
        eventsReceived++;
        console.log(`💰 [ENVELOPE #${eventsReceived}] MONEY ENVELOPE!`);
        console.log(`💰 Type: ${data.envelopeType || 'Unknown'}`);
        console.log(`💰 Coins: ${data.coins || 'Unknown'}`);
        console.log(`💰 Count: ${data.count || 'Unknown'}`);
        
        // Debug: Log raw ENVELOPE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw ENVELOPE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.QUESTIONNAIRE, (data) => {
        eventsReceived++;
        console.log(`❓ [QUESTIONNAIRE #${eventsReceived}] POLL/QUESTION!`);
        console.log(`❓ Question: ${data.questionText || 'Unknown'}`);
        console.log(`❓ Type: ${data.questionType || 'Unknown'}`);
        
        // Debug: Log raw QUESTIONNAIRE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw QUESTIONNAIRE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINKMIC_BATTLE, (data) => {
        eventsReceived++;
        console.log(`⚔️ [LINKMIC_BATTLE #${eventsReceived}] BATTLE UPDATE!`);
        console.log(`⚔️ Battle Status: ${data.battleStatus || 'Unknown'}`);
        console.log(`⚔️ Battle Type: ${data.battleType || 'Unknown'}`);
        
        // Debug: Log raw LINKMIC_BATTLE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINKMIC_BATTLE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINKMIC_ARMIES, (data) => {
        eventsReceived++;
        console.log(`🏆 [LINKMIC_ARMIES #${eventsReceived}] ARMIES UPDATE!`);
        console.log(`🏆 Army Count: ${data.battleArmies?.length || 'Unknown'}`);
        
        // Debug: Log raw LINKMIC_ARMIES data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINKMIC_ARMIES data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINKMIC_CONTRIBUTOR, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`🎖️ [LINKMIC_CONTRIBUTOR #${eventsReceived}] CONTRIBUTOR!`);
        console.log(`🎖️ User ID: ${userId}`);
        console.log(`🎖️ Nickname: ${nickname}`);
        console.log(`🎖️ Contribution: ${data.contribution || 'Unknown'}`);
        
        // Debug: Log raw LINKMIC_CONTRIBUTOR data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINKMIC_CONTRIBUTOR data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    // Additional missing events
    connection.on(WebcastEvent.LIVE_INTRO, (data) => {
        eventsReceived++;
        console.log(`🎬 [LIVE_INTRO #${eventsReceived}] LIVE INTRO!`);
        console.log(`🎬 Intro Type: ${data.introType || 'Unknown'}`);
        console.log(`🎬 Content: ${data.content || 'Unknown'}`);
        
        // Debug: Log raw LIVE_INTRO data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LIVE_INTRO data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.STREAM_END, (data) => {
        eventsReceived++;
        console.log(`🔚 [STREAM_END #${eventsReceived}] STREAM ENDED!`);
        console.log(`🔚 Reason: ${data.reason || 'Unknown'}`);
        console.log(`🔚 End Time: ${data.endTime || 'Unknown'}`);
        
        // Debug: Log raw STREAM_END data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw STREAM_END data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.EMOTE, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`😄 [EMOTE #${eventsReceived}] EMOTE!`);
        console.log(`😄 User ID: ${userId}`);
        console.log(`😄 Nickname: ${nickname}`);
        console.log(`😄 Emote: ${data.emote || 'Unknown'}`);
        
        // Debug: Log raw EMOTE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw EMOTE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.GOAL_UPDATE, (data) => {
        eventsReceived++;
        console.log(`🎯 [GOAL_UPDATE #${eventsReceived}] GOAL UPDATE!`);
        console.log(`🎯 Goal Type: ${data.goalType || 'Unknown'}`);
        console.log(`🎯 Progress: ${data.progress || 'Unknown'}`);
        console.log(`🎯 Target: ${data.target || 'Unknown'}`);
        
        // Debug: Log raw GOAL_UPDATE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw GOAL_UPDATE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.ROOM_MESSAGE, (data) => {
        eventsReceived++;
        console.log(`📢 [ROOM_MESSAGE #${eventsReceived}] ROOM MESSAGE!`);
        console.log(`📢 Message: ${data.message || 'Unknown'}`);
        console.log(`📢 Type: ${data.messageType || 'Unknown'}`);
        
        // Debug: Log raw ROOM_MESSAGE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw ROOM_MESSAGE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.CAPTION_MESSAGE, (data) => {
        eventsReceived++;
        console.log(`📝 [CAPTION_MESSAGE #${eventsReceived}] CAPTION!`);
        console.log(`📝 Caption: ${data.caption || 'Unknown'}`);
        console.log(`📝 Language: ${data.language || 'Unknown'}`);
        
        // Debug: Log raw CAPTION_MESSAGE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw CAPTION_MESSAGE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.IM_DELETE, (data) => {
        eventsReceived++;
        console.log(`🗑️ [IM_DELETE #${eventsReceived}] MESSAGE DELETED!`);
        console.log(`🗑️ Message ID: ${data.messageId || 'Unknown'}`);
        console.log(`🗑️ Reason: ${data.reason || 'Unknown'}`);
        
        // Debug: Log raw IM_DELETE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw IM_DELETE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.IN_ROOM_BANNER, (data) => {
        eventsReceived++;
        console.log(`🏷️ [IN_ROOM_BANNER #${eventsReceived}] BANNER UPDATE!`);
        console.log(`🏷️ Banner Type: ${data.bannerType || 'Unknown'}`);
        console.log(`🏷️ Content: ${data.content || 'Unknown'}`);
        
        // Debug: Log raw IN_ROOM_BANNER data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw IN_ROOM_BANNER data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.RANK_UPDATE, (data) => {
        eventsReceived++;
        console.log(`🏅 [RANK_UPDATE #${eventsReceived}] RANK UPDATE!`);
        console.log(`🏅 Rank Type: ${data.rankType || 'Unknown'}`);
        console.log(`🏅 New Rank: ${data.newRank || 'Unknown'}`);
        console.log(`🏅 Previous Rank: ${data.previousRank || 'Unknown'}`);
        
        // Debug: Log raw RANK_UPDATE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw RANK_UPDATE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.POLL_MESSAGE, (data) => {
        eventsReceived++;
        console.log(`📊 [POLL_MESSAGE #${eventsReceived}] POLL!`);
        console.log(`📊 Question: ${data.question || 'Unknown'}`);
        console.log(`📊 Options: ${data.options?.join(', ') || 'Unknown'}`);
        console.log(`📊 Duration: ${data.duration || 'Unknown'}`);
        
        // Debug: Log raw POLL_MESSAGE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw POLL_MESSAGE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.RANK_TEXT, (data) => {
        eventsReceived++;
        console.log(`📜 [RANK_TEXT #${eventsReceived}] RANK TEXT!`);
        console.log(`📜 Text: ${data.text || 'Unknown'}`);
        console.log(`📜 Rank: ${data.rank || 'Unknown'}`);
        
        // Debug: Log raw RANK_TEXT data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw RANK_TEXT data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINK_MIC_BATTLE_PUNISH_FINISH, (data) => {
        eventsReceived++;
        console.log(`⚖️ [LINK_MIC_BATTLE_PUNISH_FINISH #${eventsReceived}] BATTLE PUNISHMENT!`);
        console.log(`⚖️ Punishment Type: ${data.punishmentType || 'Unknown'}`);
        console.log(`⚖️ Duration: ${data.duration || 'Unknown'}`);
        
        // Debug: Log raw LINK_MIC_BATTLE_PUNISH_FINISH data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINK_MIC_BATTLE_PUNISH_FINISH data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINK_MIC_BATTLE_TASK, (data) => {
        eventsReceived++;
        console.log(`📋 [LINK_MIC_BATTLE_TASK #${eventsReceived}] BATTLE TASK!`);
        console.log(`📋 Task Type: ${data.taskType || 'Unknown'}`);
        console.log(`📋 Description: ${data.description || 'Unknown'}`);
        
        // Debug: Log raw LINK_MIC_BATTLE_TASK data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINK_MIC_BATTLE_TASK data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINK_MIC_FAN_TICKET_METHOD, (data) => {
        eventsReceived++;
        console.log(`🎫 [LINK_MIC_FAN_TICKET_METHOD #${eventsReceived}] FAN TICKET METHOD!`);
        console.log(`🎫 Method: ${data.method || 'Unknown'}`);
        console.log(`🎫 Amount: ${data.amount || 'Unknown'}`);
        
        // Debug: Log raw LINK_MIC_FAN_TICKET_METHOD data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINK_MIC_FAN_TICKET_METHOD data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINK_MIC_METHOD, (data) => {
        eventsReceived++;
        console.log(`🔗 [LINK_MIC_METHOD #${eventsReceived}] LINK MIC METHOD!`);
        console.log(`🔗 Method: ${data.method || 'Unknown'}`);
        console.log(`🔗 Status: ${data.status || 'Unknown'}`);
        
        // Debug: Log raw LINK_MIC_METHOD data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINK_MIC_METHOD data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.UNAUTHORIZED_MEMBER, (data) => {
        eventsReceived++;
        const { userId, nickname } = getUserInfo(data);
        console.log(`🚫 [UNAUTHORIZED_MEMBER #${eventsReceived}] UNAUTHORIZED MEMBER!`);
        console.log(`🚫 User ID: ${userId}`);
        console.log(`🚫 Nickname: ${nickname}`);
        console.log(`🚫 Reason: ${data.reason || 'Unknown'}`);
        
        // Debug: Log raw UNAUTHORIZED_MEMBER data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw UNAUTHORIZED_MEMBER data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.OEC_LIVE_SHOPPING, (data) => {
        eventsReceived++;
        console.log(`🛍️ [OEC_LIVE_SHOPPING #${eventsReceived}] LIVE SHOPPING!`);
        console.log(`🛍️ Product: ${data.productName || 'Unknown'}`);
        console.log(`🛍️ Price: ${data.price || 'Unknown'}`);
        console.log(`🛍️ Action: ${data.action || 'Unknown'}`);
        
        // Debug: Log raw OEC_LIVE_SHOPPING data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw OEC_LIVE_SHOPPING data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.MSG_DETECT, (data) => {
        eventsReceived++;
        console.log(`🔍 [MSG_DETECT #${eventsReceived}] MESSAGE DETECTED!`);
        console.log(`🔍 Detection Type: ${data.detectionType || 'Unknown'}`);
        console.log(`🔍 Confidence: ${data.confidence || 'Unknown'}`);
        
        // Debug: Log raw MSG_DETECT data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw MSG_DETECT data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINK_MESSAGE, (data) => {
        eventsReceived++;
        console.log(`🔗 [LINK_MESSAGE #${eventsReceived}] LINK MESSAGE!`);
        console.log(`🔗 Message: ${data.message || 'Unknown'}`);
        console.log(`🔗 Link Type: ${data.linkType || 'Unknown'}`);
        
        // Debug: Log raw LINK_MESSAGE data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINK_MESSAGE data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.ROOM_VERIFY, (data) => {
        eventsReceived++;
        console.log(`✅ [ROOM_VERIFY #${eventsReceived}] ROOM VERIFICATION!`);
        console.log(`✅ Verification Type: ${data.verificationType || 'Unknown'}`);
        console.log(`✅ Status: ${data.status || 'Unknown'}`);
        
        // Debug: Log raw ROOM_VERIFY data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw ROOM_VERIFY data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.LINK_LAYER, (data) => {
        eventsReceived++;
        console.log(`🔗 [LINK_LAYER #${eventsReceived}] LINK LAYER!`);
        console.log(`🔗 Layer Type: ${data.layerType || 'Unknown'}`);
        console.log(`🔗 Status: ${data.status || 'Unknown'}`);
        
        // Debug: Log raw LINK_LAYER data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw LINK_LAYER data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    connection.on(WebcastEvent.ROOM_PIN, (data) => {
        eventsReceived++;
        console.log(`📌 [ROOM_PIN #${eventsReceived}] ROOM PIN!`);
        console.log(`📌 Pin Type: ${data.pinType || 'Unknown'}`);
        console.log(`📌 Content: ${data.content || 'Unknown'}`);
        
        // Debug: Log raw ROOM_PIN data structure for first few events
        if (eventsReceived <= 3) {
            console.log(`🔍 [DEBUG] Raw ROOM_PIN data structure:`);
            console.log(JSON.stringify(data, null, 2));
        }
        
        console.log("-" .repeat(30));
    });
    
    // Handle QUESTION_NEW (might be different from QUESTIONNAIRE)
    try {
        connection.on(WebcastEvent.QUESTION_NEW, (data) => {
            eventsReceived++;
            console.log(`❓ [QUESTION_NEW #${eventsReceived}] NEW QUESTION!`);
            console.log(`❓ Question: ${data.questionText || 'Unknown'}`);
            console.log(`❓ Type: ${data.questionType || 'Unknown'}`);
            console.log("-" .repeat(30));
        });
    } catch (error) {
        // QUESTION_NEW might not exist, use QUESTIONNAIRE instead
        console.log("ℹ️ QUESTION_NEW event not available, using QUESTIONNAIRE");
    }
    
    // ----- Run the Connection -----
    try {
        console.log("🚀 Starting connection...");
        console.log("Press Ctrl+C to stop the test");
        console.log("-" .repeat(50));
        
        // Connect to the live stream
        await connection.connect();
        
        // Keep the connection alive
        console.log("⏰ Connection established! Waiting for real-time events...");
        console.log("💡 TIP: If no events appear, the stream might have low activity");
        console.log("💡 TIP: Try running this during peak hours when more people are active");
        console.log("-" .repeat(50));
        
        // Keep the process running
        process.on('SIGINT', () => {
            console.log("\n⏹️ Test stopped by user");
            console.log(`📊 Total events received: ${eventsReceived}`);
            console.log(`⏱️ Total runtime: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds`);
            
            if (eventsReceived === 0) {
                console.log("\n🔍 Analysis:");
                console.log("❌ No events received - possible reasons:");
                console.log("   1. Stream has very low activity");
                console.log("   2. Stream is live but no one is chatting/liking");
                console.log("   3. Connection issues with TikTok's servers");
                console.log("   4. Stream might be ending soon");
                console.log("\n💡 Try:");
                console.log("   - Different time of day");
                console.log("   - Different streamer");
                console.log("   - Wait longer (some streams take time to get active)");
            }
            
            console.log("✅ Test completed successfully!");
            process.exit(0);
        });
        
    } catch (error) {
        // Handle cases where the streamer is not live or connection fails
        console.log(`❌ [ERROR] Could not connect to the live stream.`);
        console.log(`Details: ${error.message}`);
        console.log(`📊 Total events received: ${eventsReceived}`);
        console.log(`⏱️ Total runtime: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds`);
        console.log("\n🔍 Troubleshooting tips:");
        console.log("1. Make sure the streamer is currently live on TikTok");
        console.log("2. Verify the username is correct (without the @ symbol)");
        console.log("3. Check your internet connection");
        console.log("4. Ensure the TikTok-Live-Connector library is properly installed");
        console.log("5. Try a different live streamer");
        console.log("6. Wait longer - some streams take time to establish connection");
        process.exit(1);
    }
}

// Run the test
runTest().catch(error => {
    console.error(`\n❌ Unexpected error: ${error}`);
    process.exit(1);
});
