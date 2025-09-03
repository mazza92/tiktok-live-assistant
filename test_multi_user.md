# Multi-User TikTok Live Assistant - Testing Guide

## Overview
The TikTok Live Assistant now supports multiple users monitoring different TikTok streamers simultaneously. Each user gets their own isolated session with independent metrics and connections.

## How It Works

### Session-Based Architecture
- Each user connection creates a unique session with a session ID
- Sessions are isolated - users only see data from their own streamer
- Multiple users can monitor different TikTok streamers at the same time
- Sessions are automatically cleaned up when users disconnect

### Key Features
1. **Session Isolation**: Each user has their own metrics, connection, and data
2. **Independent Connections**: Users can connect to different TikTok streamers simultaneously
3. **Session Management**: Automatic session creation, tracking, and cleanup
4. **Real-time Updates**: Each session receives only relevant updates
5. **Session Info Display**: Users can see their session ID and status

## Testing Instructions

### Test 1: Multiple Users, Different Streamers
1. Open the dashboard in two different browser windows/tabs
2. In Window 1: Connect to streamer "username1"
3. In Window 2: Connect to streamer "username2"
4. Verify that:
   - Each window shows different session IDs
   - Each window only shows data from their respective streamer
   - Metrics are independent between sessions
   - No interference between the two connections

### Test 2: Multiple Users, Same Streamer
1. Open the dashboard in two different browser windows/tabs
2. In both windows: Connect to the same streamer "username1"
3. Verify that:
   - Each window has its own session ID
   - Both windows show the same live data (from the same streamer)
   - Metrics are synchronized between sessions
   - Both users see the same chat, likes, gifts, etc.

### Test 3: Session Cleanup
1. Connect to a streamer in one window
2. Close the browser window
3. Check the server logs - session should be cleaned up after 30 seconds
4. Verify that the TikTok connection is properly disconnected

### Test 4: Session Info Display
1. Open the dashboard
2. Check the session info display in the header
3. Connect to a streamer
4. Verify that the session info updates with:
   - Session ID
   - Status (connected/disconnected)
   - Streamer username
   - Total number of active sessions

## API Endpoints

### Debug Endpoint
Visit `/debug` to see all active sessions:
```json
{
  "message": "Current status and active sessions",
  "totalSessions": 2,
  "totalConnectedClients": 2,
  "sessions": [
    {
      "sessionId": "session_1_1234567890",
      "username": "streamer1",
      "connectedClients": 1,
      "isConnecting": false,
      "hasConnection": true,
      "createdAt": "2024-01-01T12:00:00.000Z",
      "lastActivity": "2024-01-01T12:05:00.000Z",
      "metrics": {
        "currentViewerCount": 150,
        "totalLikes": 500,
        "totalGifts": 25,
        "totalComments": 100
      }
    }
  ]
}
```

## Technical Details

### Session Management
- Sessions are stored in a Map with session IDs as keys
- Each session contains: connection, metrics, username, WebSocket clients
- Sessions are automatically cleaned up when no clients remain
- 30-second delay before cleanup to handle reconnections

### WebSocket Routing
- Messages are routed to specific sessions based on session ID
- Each session only receives relevant updates
- Global broadcasts are replaced with session-specific broadcasts

### Connection Handling
- Each session has its own TikTok connection
- Independent reconnection logic per session
- Session-specific event handlers for chat, likes, gifts, etc.

## Benefits

1. **Scalability**: Support for unlimited concurrent users
2. **Isolation**: Users don't interfere with each other
3. **Flexibility**: Users can monitor different or same streamers
4. **Resource Management**: Automatic cleanup prevents memory leaks
5. **Real-time**: Each user gets real-time updates for their streamer

## Troubleshooting

### Common Issues
1. **Session not created**: Check WebSocket connection
2. **Wrong data shown**: Verify session ID in browser console
3. **Connection not working**: Check if streamer is live
4. **Session not cleaned up**: Check server logs for cleanup messages

### Debug Commands
- Check browser console for session ID logs
- Visit `/debug` endpoint for server-side session info
- Monitor server logs for session creation/cleanup messages
