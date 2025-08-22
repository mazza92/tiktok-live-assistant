# Configuration Template for TikTok Live Test
# Copy this file to config.py and modify the values

# TikTok Live Streamer Configuration
TIKTOK_USERNAME = "@YOUR_TIKTOK_USERNAME"  # Replace with actual username

# Event Filtering (set to True to enable, False to disable)
ENABLE_COMMENTS = True      # Chat comments
ENABLE_LIKES = True         # Like events
ENABLE_GIFTS = True         # Gift events
ENABLE_FOLLOWS = True       # Follow events
ENABLE_SHARES = True        # Share events

# Display Settings
SHOW_TIMESTAMPS = True      # Add timestamps to events
SHOW_USER_IDS = False       # Show user IDs (useful for debugging)
SHOW_EMOJI = True           # Show emojis in output

# Connection Settings
CONNECTION_TIMEOUT = 30     # Connection timeout in seconds
RECONNECT_ATTEMPTS = 3      # Number of reconnection attempts

# Logging
LOG_LEVEL = "INFO"          # DEBUG, INFO, WARNING, ERROR
SAVE_TO_FILE = False        # Save events to a log file
LOG_FILENAME = "tiktok_live_events.log"
