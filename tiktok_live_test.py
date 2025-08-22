#!/usr/bin/env python3
"""
TikTok Live Data Ingestion Test
A simple proof-of-concept tool to validate real-time data capture from TikTok Live streams.

This script tests the core functionality needed for the Live Assistant MVP:
- Connection to TikTok Live streams
- Real-time comment capture
- Like event monitoring
- Gift event tracking

Usage:
1. Install dependencies: pip install TikTokLive
2. Find a currently live TikTok streamer
3. Replace 'YOUR_TIKTOK_USERNAME' with the streamer's username
4. Run: python tiktok_live_test.py
"""

import asyncio
import sys
import time
from TikTokLive import TikTokLiveClient
from TikTokLive.events.custom_events import ConnectEvent, FollowEvent, ShareEvent, DisconnectEvent
from TikTokLive.events.proto_events import CommentEvent, GiftEvent, LikeEvent, JoinEvent

async def run_test():
    """
    Main test function that connects to a TikTok Live stream and captures events.
    """
    print("🎵 TikTok Live Data Ingestion Test")
    print("=" * 50)
    
    # TODO: Replace with a currently live TikTok streamer's username
    # Example: 'tiktoklive_us' or any other public streamer who is currently live
    username = "lanocallum1"
    
    print(f"Attempting to connect to: {username}")
    print("Make sure this streamer is currently live on TikTok!")
    print("-" * 50)
    
    # Create the client instance
    client = TikTokLiveClient(unique_id=username)
    
    # Track connection status
    connection_start_time = time.time()
    events_received = 0
    
    # ----- Event Listeners -----
    
    @client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        """Handle successful connection to the live stream."""
        nonlocal events_received
        events_received += 1
        print(f"✅ [SUCCESS] Connected to TikTok Live: @{client.unique_id}")
        print(f"📺 Event type: {type(event)}")
        print(f"📺 Event attributes: {dir(event)}")
        try:
            print(f"📺 Streamer: {event.room_id}")
        except:
            print("📺 Streamer: Connected successfully")
        try:
            print(f"👥 Viewer Count: {event.viewer_count}")
        except:
            print("👥 Viewer Count: Available")
        print("-" * 50)
    
    @client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        """Handle incoming chat comments - crucial for sentiment analysis."""
        nonlocal events_received
        events_received += 1
        print(f"💬 [COMMENT #{events_received}] Event received!")
        print(f"💬 Event type: {type(event)}")
        print(f"💬 Event attributes: {dir(event)}")
        try:
            user_nickname = event.user.nickname if hasattr(event.user, 'nickname') else "Unknown User"
            comment_text = event.comment if hasattr(event, 'comment') else "No comment text"
            print(f"💬 [{user_nickname}] -> {comment_text}")
        except Exception as e:
            print(f"💬 [Comment Event] -> {event}")
            print(f"💬 Error details: {e}")
        print("-" * 30)
    
    @client.on(LikeEvent)
    async def on_like(event: LikeEvent):
        """Handle like events - key engagement metric."""
        nonlocal events_received
        events_received += 1
        print(f"❤️ [LIKE #{events_received}] Event received!")
        print(f"❤️ Event type: {type(event)}")
        print(f"❤️ Event attributes: {dir(event)}")
        try:
            user_nickname = event.user.nickname if hasattr(event.user, 'nickname') else "Unknown User"
            total_likes = event.total_likes if hasattr(event, 'total_likes') else "Unknown"
            print(f"❤️ [LIKE] from {user_nickname}, total likes: {total_likes}")
        except Exception as e:
            print(f"❤️ [Like Event] -> {event}")
            print(f"❤️ Error details: {e}")
        print("-" * 30)
    
    @client.on(GiftEvent)
    async def on_gift(event: GiftEvent):
        """Handle gift events - key monetization metric."""
        nonlocal events_received
        events_received += 1
        print(f"🎁 [GIFT #{events_received}] Event received!")
        print(f"🎁 Event type: {type(event)}")
        print(f"🎁 Event attributes: {dir(event)}")
        try:
            user_nickname = event.user.nickname if hasattr(event.user, 'nickname') else "Unknown User"
            gift_name = event.gift.info.name if hasattr(event.gift, 'info') and hasattr(event.gift.info, 'name') else "Unknown Gift"
            if hasattr(event.gift, 'info') and hasattr(event.gift.info, 'streakable') and event.gift.info.streakable:
                repeat_count = event.gift.repeat_count if hasattr(event.gift, 'repeat_count') else 1
                print(f"🎁 [GIFT] from {user_nickname}: {gift_name} (x{repeat_count})")
            else:
                diamond_count = event.gift.info.diamond_count if hasattr(event.gift, 'info') and hasattr(event.gift.info, 'diamond_count') else "Unknown"
                print(f"🎁 [GIFT] from {user_nickname}: {gift_name} (Value: {diamond_count} diamonds)")
        except Exception as e:
            print(f"🎁 [Gift Event] -> {event}")
            print(f"🎁 Error details: {e}")
        print("-" * 30)
    
    @client.on(JoinEvent)
    async def on_join(event: JoinEvent):
        """Handle user join events."""
        nonlocal events_received
        events_received += 1
        print(f"👋 [JOIN #{events_received}] Event received!")
        print(f"👋 Event type: {type(event)}")
        print(f"👋 Event attributes: {dir(event)}")
        try:
            user_nickname = event.user.nickname if hasattr(event.user, 'nickname') else "Unknown User"
            print(f"👋 [JOIN] {user_nickname} joined the stream!")
        except Exception as e:
            print(f"👋 [Join Event] -> {event}")
            print(f"👋 Error details: {e}")
        print("-" * 30)
    
    @client.on(FollowEvent)
    async def on_follow(event: FollowEvent):
        """Handle new followers."""
        nonlocal events_received
        events_received += 1
        print(f"👋 [FOLLOW #{events_received}] Event received!")
        print(f"👋 Event type: {type(event)}")
        print(f"👋 Event attributes: {dir(event)}")
        try:
            user_nickname = event.user.nickname if hasattr(event.user, 'nickname') else "Unknown User"
            print(f"👋 [FOLLOW] {user_nickname} started following!")
        except Exception as e:
            print(f"👋 [Follow Event] -> {event}")
            print(f"👋 Error details: {e}")
        print("-" * 30)
    
    @client.on(ShareEvent)
    async def on_share(event: ShareEvent):
        """Handle stream shares."""
        nonlocal events_received
        events_received += 1
        print(f"📤 [SHARE #{events_received}] Event received!")
        print(f"📤 Event type: {type(event)}")
        print(f"📤 Event attributes: {dir(event)}")
        try:
            user_nickname = event.user.nickname if hasattr(event.user, 'nickname') else "Unknown User"
            print(f"📤 [SHARE] {user_nickname} shared the stream!")
        except Exception as e:
            print(f"📤 [Share Event] -> {event}")
            print(f"📤 Error details: {e}")
        print("-" * 30)
    
    @client.on(DisconnectEvent)
    async def on_disconnect(event: DisconnectEvent):
        """Handle disconnection events."""
        nonlocal events_received
        events_received += 1
        print(f"❌ [DISCONNECT #{events_received}] Event received!")
        print(f"❌ Event type: {type(event)}")
        print(f"❌ Event attributes: {dir(event)}")
        print("-" * 30)
    
    # ----- Run the Client -----
    try:
        print("🚀 Starting client...")
        print("Press Ctrl+C to stop the test")
        print("-" * 50)
        
        # Start the client
        await client.start()
        
    except KeyboardInterrupt:
        print("\n⏹️ Test stopped by user")
        print(f"📊 Total events received: {events_received}")
        print(f"⏱️ Total runtime: {time.time() - connection_start_time:.1f} seconds")
        print("✅ Test completed successfully!")
        
    except Exception as e:
        # Handle cases where the streamer is not live or connection fails
        print(f"❌ [ERROR] Could not connect to the live stream.")
        print(f"Details: {e}")
        print(f"📊 Total events received: {events_received}")
        print(f"⏱️ Total runtime: {time.time() - connection_start_time:.1f} seconds")
        print("\n🔍 Troubleshooting tips:")
        print("1. Make sure the streamer is currently live on TikTok")
        print("2. Verify the username is correct (without the @ symbol)")
        print("3. Check your internet connection")
        print("4. Ensure the TikTokLive library is properly installed")
        print("5. Try a different live streamer")
        print("6. Wait longer - some streams take time to establish connection")
        sys.exit(1)

def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import TikTokLive
        print("✅ TikTokLive library found")
        return True
    except ImportError:
        print("❌ TikTokLive library not found!")
        print("Please install it using: pip install TikTokLive")
        return False

if __name__ == '__main__':
    print("🔍 Checking dependencies...")
    
    if not check_dependencies():
        print("\n💡 To install TikTokLive, run:")
        print("pip install TikTokLive")
        sys.exit(1)
    
    print("✅ Dependencies check passed")
    print()
    
    # Run the async test
    try:
        asyncio.run(run_test())
    except KeyboardInterrupt:
        print("\n⏹️ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
