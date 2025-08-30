# Environment Variable Setup Guide

## Setting GEMINI_API_KEY Environment Variable

The `GEMINI_API_KEY` environment variable is required for the AI-powered prompt generation system to work. Here's how to set it up:

### 1. Get Your API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Set Environment Variable

#### Option A: Create a `.env` file (Recommended for development)

1. In your project root directory, create a file named `.env`
2. Add this line to the file:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Replace `your_actual_api_key_here` with your real API key
4. **Important**: Add `.env` to your `.gitignore` file to keep your API key secure

#### Option B: Set in Windows PowerShell (Current Session Only)

```powershell
$env:GEMINI_API_KEY="your_actual_api_key_here"
```

#### Option C: Set in Windows Command Prompt (Current Session Only)

```cmd
set GEMINI_API_KEY=your_actual_api_key_here
```

#### Option D: Set System Environment Variable (Permanent)

1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Click "Environment Variables"
3. Under "User variables", click "New"
4. Variable name: `GEMINI_API_KEY`
5. Variable value: Your actual API key
6. Click OK and restart your terminal/IDE

### 3. Verify Setup

Run this command to verify the environment variable is set:

```powershell
echo $env:GEMINI_API_KEY
```

Or in Command Prompt:
```cmd
echo %GEMINI_API_KEY%
```

### 4. Test the Integration

After setting the environment variable, test the Gemini integration:

```bash
node test_gemini.js
```

### Security Notes

- **Never commit your API key to version control**
- **Never share your API key publicly**
- The `.env` file should be in your `.gitignore`
- Consider using different API keys for development and production

### Troubleshooting

If you get "API key not found" errors:
1. Verify the environment variable is set correctly
2. Restart your terminal/IDE after setting system environment variables
3. Check that the `.env` file is in the correct directory
4. Ensure there are no extra spaces or quotes around the API key
