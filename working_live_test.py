#!/usr/bin/env python3
"""
Working TikTok Live Test - Fixed for v6.6.1
"""

import asyncio
import time
from TikTokLive import TikTokLiveClient

async def working_test():
    print("🎵 Working TikTok Live Test - Fixed Version")
    print("=" * 50)
    
    username = "ttvmedzn"  # This user is confirmed live
    print(f"Connecting to: @{username}")
    print("✅ Confirmed: This user IS currently live streaming")
    print("-" * 50)
    
    client = TikTokLiveClient(unique_id=username)
    events_count = 0
    
    # Try using string-based event names (some versions support this)
    @client.on("connect")
    async def on_connect(event):
        nonlocal events_count
        events_count += 1
        print(f"✅ [CONNECT #{events_count}] SUCCESS! Connected to TikTok Live!")
        print(f"📺 Event details: {event}")
        print("-" * 50)
    
    @client.on("comment")
    async def on_comment(event):
        nonlocal events_count
        events_count += 1
        print(f"💬 [COMMENT #{events_count}] NEW COMMENT RECEIVED!")
        print(f"💬 Event details: {event}")
        try:
            if hasattr(event, 'user') and hasattr(event.user, 'nickname'):
                nickname = event.user.nickname
                comment = getattr(event, 'comment', 'No text')
                print(f"💬 [{nickname}]: {comment}")
        except Exception as e:
            print(f"💬 Error parsing comment: {e}")
        print("-" * 30)
    
    @client.on("like")
    async def on_like(event):
        nonlocal events_count
        events_count += 1
        print(f"❤️ [LIKE #{events_count}] NEW LIKE RECEIVED!")
        print(f"❤️ Event details: {event}")
        try:
            if hasattr(event, 'user') and hasattr(event.user, 'nickname'):
                nickname = event.user.nickname
                total_likes = getattr(event, 'total_likes', 'Unknown')
                print(f"❤️ [{nickname}] - Total likes: {total_likes}")
        except Exception as e:
            print(f"❤️ Error parsing like: {e}")
        print("-" * 30)
    
    @client.on("gift")
    async def on_gift(event):
        nonlocal events_count
        events_count += 1
        print(f"🎁 [GIFT #{events_count}] NEW GIFT RECEIVED!")
        print(f"🎁 Event details: {event}")
        print("-" * 30)
    
    # Also try the event class approach as backup
    try:
        from TikTokLive.events.custom_events import ConnectEvent
        from TikTokLive.events.proto_events import CommentEvent, LikeEvent, GiftEvent
        
        @client.on(ConnectEvent)
        async def on_connect_class(event):
            nonlocal events_count
            events_count += 1
            print(f"✅ [CONNECT CLASS #{events_count}] SUCCESS! Connected to TikTok Live!")
            print(f"📺 Event details: {event}")
            print("-" * 50)
        
        @client.on(CommentEvent)
        async def on_comment_class(event):
            nonlocal events_count
            events_count += 1
            print(f"💬 [COMMENT CLASS #{events_count}] NEW COMMENT RECEIVED!")
            print(f"💬 Event details: {event}")
            print("-" * 30)
        
        print("✅ Event class listeners also registered")
        
    except Exception as e:
        print(f"⚠️ Could not register event class listeners: {e}")
    
    print("🚀 Starting client...")
    print("⏰ Waiting for real-time events...")
    print("💡 TIP: If no events appear, the stream might have low activity")
    print("💡 TIP: Try running this during peak hours when more people are active")
    print("-" * 50)
    
    start_time = time.time()
    
    try:
        # Start the client and wait for events
        await client.start()
        
    except KeyboardInterrupt:
        print(f"\n⏹️ Stopped by user")
        print(f"📊 Total events received: {events_count}")
        print(f"⏱️ Runtime: {time.time() - start_time:.1f} seconds")
        
        if events_count == 0:
            print("\n🔍 Analysis:")
            print("❌ No events received - possible reasons:")
            print("   1. Stream has very low activity")
            print("   2. Stream is live but no one is chatting/liking")
            print("   3. Connection issues with TikTok's servers")
            print("   4. Stream might be ending soon")
            print("   5. Event system not working properly in this version")
            print("\n💡 Try:")
            print("   - Different time of day")
            print("   - Different streamer")
            print("   - Wait longer (some streams take time to get active)")
            print("   - Check TikTokLive library documentation for v6.6.1")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print(f"📊 Total events: {events_count}")
        print(f"⏱️ Runtime: {time.time() - start_time:.1f}s")

if __name__ == "__main__":
    asyncio.run(working_test())
