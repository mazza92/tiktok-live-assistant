# 🎭 TikTok Live MVP - Live Assistant System

## 🚀 **Overview**

This MVP transforms your TikTok Live proof-of-concept into a functional, value-driven system with real-time data processing and a beautiful dashboard interface. It implements the "Wizard of Oz" approach where you manually control engagement prompts while the system automatically processes live data.

## 🏗️ **Architecture**

```
TikTok Live Stream → Data Processor → WebSocket → Dashboard
                              ↓
                        Wizard Control Panel
```

### **Components:**

1. **Data Processor** (`tiktok_data_processor.js`) - Backend service
2. **Dashboard** (`dashboard.html`) - Streamer-facing interface  
3. **Wizard Control** (`/wizard` endpoint) - Your control panel
4. **WebSocket Server** - Real-time communication

## 🛠️ **Setup & Installation**

### **Prerequisites:**
- Node.js (v16+)
- npm
- TikTok Live streamer username

### **Installation:**
```bash
npm install express ws
```

### **Quick Start:**
```bash
# Option 1: Use the batch file (Windows)
start_mvp.bat

# Option 2: Manual start
node tiktok_data_processor.js
# Then open dashboard.html in your browser
# And navigate to http://localhost:3000/wizard
```

## 📊 **Features**

### **Real-Time Metrics:**
- **Live Viewer Count** - Current stream viewers
- **Likes per Minute** - Engagement rate
- **Gifts per Minute** - Monetization tracking
- **Comments per Minute** - Chat activity
- **Audience Sentiment** - Manual Wizard control

### **Data Processing:**
- **Comment Cleaning** - Removes emojis, mentions, trivial content
- **Event Filtering** - Focuses on essential events only
- **Real-Time Calculation** - Per-minute metrics updates
- **Data Storage** - Recent activity tracking

### **Wizard Control:**
- **Quick Prompts** - Pre-written engagement messages
- **Custom Prompts** - Type your own messages
- **Sentiment Override** - Manual sentiment score control
- **Real-Time Metrics** - Live data monitoring

## 🎯 **Event Coverage**

### **Essential Events (MVP Focus):**
- ✅ **CHAT** - Comment processing for sentiment analysis
- ✅ **LIKE** - Engagement tracking
- ✅ **ROOM_USER** - Viewer count monitoring
- ✅ **GIFT** - Monetization metrics

### **Additional Events (Available):**
- Member updates, follows, shares, joins, etc.

## 🔧 **Configuration**

### **Streamer Username:**
Edit `tiktok_data_processor.js` line 28:
```javascript
const username = "your_streamer_username";
```

### **Port Configuration:**
Default port is 3000. Change in the script if needed.

## 📱 **Dashboard Interface**

### **Metrics Grid:**
- Live viewer count
- Engagement rates (likes, gifts, comments per minute)
- Real-time updates every second

### **Sentiment Gauge:**
- Visual representation of audience sentiment
- Manual control via Wizard panel
- Color-coded: Red (negative) → Yellow (neutral) → Green (positive)

### **Prompt Panel:**
- Large, prominent display of Wizard messages
- Auto-hides after 30 seconds
- Pulsing animation for attention

### **Activity Feed:**
- Recent chat, likes, gifts, and system events
- Timestamped entries
- Auto-scrolling with latest items first

## 🎭 **Wizard Control Panel**

### **Quick Prompts:**
- Ask for Engagement
- Game Suggestions
- Shout Outs
- Polls
- Break Time

### **Custom Prompts:**
- Type any message
- Send instantly to streamer
- Real-time delivery

### **Sentiment Control:**
- Slider from -100 to +100
- Immediate dashboard update
- Visual gauge movement

## 🔌 **API Endpoints**

### **WebSocket Events:**
- `metrics` - Real-time metrics updates
- `wizardPrompt` - New prompts from Wizard
- `chat` - Processed comment data
- `like` - Like event data
- `gift` - Gift event data
- `roomUser` - Viewer count updates

### **HTTP Endpoints:**
- `GET /wizard` - Wizard control interface
- `POST /send-prompt` - Send custom prompts
- `POST /update-sentiment` - Update sentiment score
- `GET /metrics` - Current metrics data

## 📈 **Data Flow**

1. **TikTok Live Connection** → Raw event data
2. **Event Processing** → Clean, structured data
3. **Metrics Calculation** → Real-time statistics
4. **WebSocket Broadcast** → Dashboard updates
5. **Wizard Control** → Manual prompt injection
6. **Dashboard Display** → Streamer interface

## 🎨 **UI Features**

### **Design Principles:**
- **Glassmorphism** - Modern, translucent design
- **Responsive** - Works on all screen sizes
- **Real-Time** - Live updates without refresh
- **Accessible** - Clear, readable metrics

### **Visual Elements:**
- Gradient backgrounds
- Backdrop blur effects
- Smooth animations
- Color-coded indicators
- Interactive hover effects

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **"Cannot connect to WebSocket"**
   - Ensure data processor is running
   - Check port 3000 is available
   - Verify firewall settings

2. **"No data appearing"**
   - Confirm streamer is live
   - Check TikTok Live connection
   - Verify username is correct

3. **"Dashboard not updating"**
   - Check WebSocket connection status
   - Refresh browser page
   - Verify server is running

### **Debug Mode:**
Check the data processor console for detailed logs and connection status.

## 🔮 **Future Enhancements**

### **Phase 2 Features:**
- AI-powered sentiment analysis
- Automated engagement suggestions
- Advanced analytics dashboard
- Multi-streamer support
- Data persistence and history

### **Integration Possibilities:**
- Discord bot integration
- Twitch overlay compatibility
- Mobile app companion
- Social media automation

## 📝 **Usage Examples**

### **Stream Start:**
1. Start the data processor
2. Open dashboard in browser
3. Open Wizard control panel
4. Monitor real-time metrics
5. Send engagement prompts

### **During Stream:**
1. Watch viewer count trends
2. Monitor engagement rates
3. Send timely prompts
4. Adjust sentiment scores
5. Track gift activity

### **Stream End:**
1. Review final metrics
2. Analyze engagement patterns
3. Plan improvements
4. Save data for analysis

## 🎯 **Success Metrics**

### **Technical Validation:**
- ✅ Real-time data ingestion
- ✅ WebSocket communication
- ✅ Dashboard responsiveness
- ✅ Event processing accuracy

### **User Experience:**
- ✅ Intuitive interface
- ✅ Real-time updates
- ✅ Easy Wizard control
- ✅ Professional appearance

## 🚀 **Getting Started**

1. **Install dependencies:** `npm install express ws`
2. **Update username:** Edit the streamer username in the script
3. **Start system:** Run `start_mvp.bat` or `node tiktok_data_processor.js`
4. **Open dashboard:** Navigate to `dashboard.html`
5. **Access Wizard:** Go to `http://localhost:3000/wizard`
6. **Start streaming:** Begin your TikTok Live session

## 🎉 **Congratulations!**

You now have a **production-ready MVP** that:
- Processes TikTok Live data in real-time
- Provides a beautiful, professional dashboard
- Enables manual Wizard control
- Scales to handle high-volume streams
- Ready for pilot user testing

**Your Live Assistant MVP is ready to deliver real value to streamers!** 🎭✨
