# 🤖 Google Generative AI Quota Fix

## Problem Description

The TikTok Live Assistant was experiencing `429 Too Many Requests` errors from the Google Generative AI API due to exceeding the free tier quota limit of **50 requests per day**.

### Root Causes

1. **Excessive API Calls**: Multiple periodic intervals were calling the AI service every 15-20 seconds
2. **No Quota Management**: No tracking or limits on daily API usage
3. **Aggressive AI Assistance**: AI prompts were generated too frequently for proactive assistance

### Error Details

```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details.
```

## Implemented Solutions

### 1. Reduced AI Check Frequency

**Before:**
- Main AI check: Every 15 seconds
- Small stream AI: Every 20 seconds
- **Total potential calls per hour: 240+**

**After:**
- Main AI check: Every 5 minutes (300 seconds)
- Small stream AI: Every 10 minutes (600 seconds)
- **Total potential calls per hour: 18**

**Environment Variables:**
```bash
AI_CHECK_INTERVAL=300000      # 5 minutes in milliseconds
AI_SMALL_STREAM_INTERVAL=600000  # 10 minutes in milliseconds
```

### 2. Daily Quota Management System

**Features:**
- Tracks daily API call count
- Resets automatically at midnight UTC
- Conservative limit of 45 requests/day (below the 50/day free tier)
- Automatic fallback to legacy system when quota exceeded

**Implementation:**
```javascript
// Check daily quota limits to avoid exceeding free tier
if (!metrics.aiQuotaTracking) {
    metrics.aiQuotaTracking = {
        dailyCount: 0,
        lastReset: new Date().toDateString(),
        quotaLimit: parseInt(process.env.AI_QUOTA_LIMIT) || 45
    };
}

// Check if we've exceeded the daily quota
if (metrics.aiQuotaTracking.dailyCount >= metrics.aiQuotaTracking.quotaLimit) {
    console.log(`🤖 [QUOTA] Daily AI quota exceeded (${metrics.aiQuotaTracking.dailyCount}/${metrics.aiQuotaTracking.quotaLimit}). Using fallback system.`);
    return generateAIEnhancedContent();
}
```

**Environment Variable:**
```bash
AI_QUOTA_LIMIT=45  # Conservative limit below the 50/day free tier
```

### 3. Quota Status API Endpoint

**Endpoint:** `GET /api/ai-quota`

**Response:**
```json
{
    "dailyCount": 12,
    "quotaLimit": 45,
    "remaining": 33,
    "lastReset": "Mon Dec 16 2024",
    "percentageUsed": 27,
    "status": "quota_available"
}
```

**Status Values:**
- `quota_available`: Under 80% usage
- `quota_warning`: 80-100% usage
- `quota_exceeded`: Over 100% usage

### 4. AI Quota Dashboard

**File:** `ai_quota_dashboard.html`

**Features:**
- Real-time quota usage monitoring
- Visual progress bar with color coding
- Auto-refresh every 30 seconds
- Responsive design for mobile and desktop
- Tips for quota management

**Access:** Open `ai_quota_dashboard.html` in your browser while the server is running

## Configuration

### Environment Variables

Update your `.env` file with these new variables:

```bash
# AI Quota Management (Free tier: 50 requests/day)
AI_QUOTA_LIMIT=45
AI_CHECK_INTERVAL=300000
AI_SMALL_STREAM_INTERVAL=600000
```

### Default Values

If environment variables are not set, the system uses these defaults:
- `AI_QUOTA_LIMIT`: 45 requests/day
- `AI_CHECK_INTERVAL`: 300000ms (5 minutes)
- `AI_SMALL_STREAM_INTERVAL`: 600000ms (10 minutes)

## Usage Monitoring

### Check Quota Status

**Via API:**
```bash
curl http://localhost:3000/api/ai-quota
```

**Via Dashboard:**
Open `ai_quota_dashboard.html` in your browser

### Quota Tracking in Logs

The system logs quota information:
```
🤖 [QUOTA] Daily AI quota reset
🤖 [QUOTA] AI call successful. Daily count: 1/45
🤖 [QUOTA] Daily AI quota exceeded (45/45). Using fallback system.
```

## Fallback System

When the AI quota is exceeded, the system automatically:

1. **Stops making API calls** to Google Generative AI
2. **Uses legacy prompt system** (`generateAIEnhancedContent()`)
3. **Maintains functionality** without AI enhancement
4. **Resets daily** at midnight UTC

## Best Practices

### For Free Tier Users

1. **Monitor Usage**: Check the quota dashboard regularly
2. **Reduce Frequency**: Consider increasing intervals if you approach limits
3. **Use Fallbacks**: The system automatically switches to fallback mode
4. **Plan Ahead**: Save AI calls for important moments

### For Production/Paid Users

1. **Increase Limits**: Set higher `AI_QUOTA_LIMIT` values
2. **Reduce Intervals**: Decrease `AI_CHECK_INTERVAL` for more responsive AI
3. **Monitor Costs**: Track API usage and costs
4. **Optimize Triggers**: Only generate AI prompts when truly needed

## Troubleshooting

### Common Issues

**Quota Still Exceeded:**
- Check if you have multiple server instances running
- Verify environment variables are set correctly
- Restart the server to reset quota tracking

**Dashboard Not Loading:**
- Ensure the server is running on port 3000
- Check browser console for JavaScript errors
- Verify the `/api/ai-quota` endpoint is accessible

**Fallback System Not Working:**
- Check server logs for errors in `generateAIEnhancedContent()`
- Verify the legacy prompt system is properly implemented

### Debug Commands

**Check Current Quota:**
```bash
curl http://localhost:3000/api/ai-quota
```

**Check Server Logs:**
Look for lines starting with `🤖 [QUOTA]` in your server console

**Reset Quota (Development):**
Restart the server to reset daily quota tracking

## Future Enhancements

### Planned Improvements

1. **Smart Quota Management**: Dynamic adjustment based on usage patterns
2. **Cost Optimization**: Prioritize AI calls based on stream importance
3. **Multiple API Keys**: Rotate between multiple API keys for higher limits
4. **Usage Analytics**: Historical quota usage and cost tracking
5. **Alert System**: Notifications when approaching quota limits

### Advanced Features

1. **Rate Limiting**: Implement token bucket algorithm for smooth distribution
2. **Priority Queuing**: Queue AI requests and process based on priority
3. **Offline Mode**: Cache AI responses for common scenarios
4. **Hybrid System**: Combine AI and rule-based prompts intelligently

## Support

If you continue to experience quota issues:

1. **Check the dashboard** for current usage
2. **Review server logs** for quota-related messages
3. **Verify environment variables** are set correctly
4. **Consider upgrading** to a paid Google AI plan
5. **Contact support** with specific error messages and logs

## Summary

The quota fix implements a comprehensive solution that:

✅ **Reduces API calls** from 240+/hour to 18/hour  
✅ **Tracks daily usage** with automatic reset  
✅ **Provides fallback system** when quota exceeded  
✅ **Offers monitoring tools** via API and dashboard  
✅ **Configurable limits** via environment variables  
✅ **Maintains functionality** even without AI service  

This ensures your TikTok Live Assistant stays within free tier limits while maintaining all core functionality.
