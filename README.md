# TikTok Live Assistant

A real-time analytics dashboard for TikTok Live streams that tracks engagement metrics, viewer behavior, and provides AI-powered insights.

## Features

- **Real-time Metrics**: Live tracking of likes, gifts, comments, shares, and followers
- **Engagement Analytics**: Viewer engagement ranking and watch time tracking
- **AI Insights**: Automated prompts and sentiment analysis
- **Interactive Dashboard**: Real-time WebSocket updates with beautiful UI
- **Session Management**: Stream-specific analytics and metrics

## Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your TikTok username
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

4. **Open dashboard**: Navigate to `http://localhost:3000`

## Deployment

### Option 1: Render (Recommended for MVP)

Render is a modern cloud platform that's perfect for Node.js applications with WebSockets.

1. **Fork/Clone this repository** to your GitHub account

2. **Sign up for Render** at [render.com](https://render.com)

3. **Create a new Web Service**:
   - Connect your GitHub repository
   - Select the repository
   - Render will auto-detect the Node.js configuration

4. **Configure environment variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render will set this automatically)
   - `TIKTOK_USERNAME`: Your TikTok username

5. **Deploy**: Click "Create Web Service"

Your app will be available at: `https://your-app-name.onrender.com`

### Option 2: Railway

Railway is another excellent PaaS option with a generous free tier.

1. **Sign up for Railway** at [railway.app](https://railway.app)

2. **Connect your GitHub repository**

3. **Add environment variables**:
   - `NODE_ENV`: `production`
   - `TIKTOK_USERNAME`: Your TikTok username

4. **Deploy**: Railway will automatically deploy your app

### Option 3: Fly.io

Fly.io offers global deployment with edge locations worldwide.

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**:
   ```bash
   fly auth login
   ```

3. **Deploy**:
   ```bash
   fly launch
   fly deploy
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `TIKTOK_USERNAME` | TikTok username to monitor | Required |

## Project Structure

```
LIVE_ASSISTANT/
├── tiktok_data_processor.js    # Main server application
├── dashboard.html              # Frontend dashboard
├── package.json               # Dependencies and scripts
├── Procfile                   # Render deployment config
├── render.yaml                # Render service configuration
├── .gitignore                 # Git ignore rules
└── env.example                # Environment variables template
```

## API Endpoints

- `GET /` - Dashboard interface
- `GET /metrics` - Current metrics data
- `GET /totals` - Room totals (likes, gifts, comments)
- `POST /set-totals` - Manually set room totals
- `GET /test` - Health check endpoint
- `GET /debug` - Debug information
- `GET /api/viewers` - Viewer information

## WebSocket Events

The dashboard receives real-time updates via WebSocket:

- `metrics` - Periodic metrics updates
- `newFollower` - New follower notifications
- `chat` - Live chat messages
- `like` - Like events
- `gift` - Gift events
- `viewerCount` - Viewer count updates
- `viewerStats` - Viewer engagement data

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**:
   - Check if the server is running
   - Verify the WebSocket URL in the dashboard

2. **TikTok Connection Issues**:
   - Ensure the TikTok username is correct
   - Check if the user is currently live streaming

3. **Port Already in Use**:
   - Change the PORT in your environment variables
   - Kill any existing Node.js processes

### Logs

Check the server console for detailed logs:
- `🔗 [CONNECTION]` - TikTok connection status
- `📊 [METRICS]` - Metrics processing
- `🆕 [FOLLOWERS]` - Follower tracking
- `❌ [ERROR]` - Error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs
3. Open an issue on GitHub

---

**Note**: This application requires the target TikTok user to be actively live streaming to function properly.
