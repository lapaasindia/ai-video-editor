# Error Logging System - User Guide

## Overview

The Lapaas AI Editor now includes a comprehensive error logging system that captures all errors, warnings, and user actions. This makes it easy to share debugging information when reporting issues.

## Features

✅ **Automatic Error Capture**
- Console errors and warnings
- Unhandled JavaScript errors
- Unhandled promise rejections
- API call failures
- User actions

✅ **Export Options**
- Download as text file (.txt)
- Download as JSON (.json)
- Copy to clipboard

✅ **Session Tracking**
- Unique session ID
- System information
- Timestamp for each entry
- Error/warning counts

## How to Access Error Logs

### 1. **Error Log Button**
Look for the **document icon** in the top-right corner of the menu bar (next to Settings).

- **No Badge**: No errors logged
- **Red Badge (1-9+)**: Number of errors captured

### 2. **Click to Open**
Click the error log button to open the Error Log modal.

### 3. **View Summary**
The modal shows:
- **Errors**: Count of error-level entries
- **Warnings**: Count of warning-level entries
- **Total**: Total log entries
- **Session ID**: Unique identifier for this session

## Export Options

### Download as Text File
**Best for**: Sharing via email, support tickets, GitHub issues

1. Click **"Download as Text File"**
2. File saves as: `lapaas-error-log-YYYY-MM-DD-HH-MM-SS.txt`
3. Share this file with support or developers

**Example Output**:
```
================================================================================
LAPAAS AI EDITOR - ERROR LOG
================================================================================

Session ID: session-1708012345678-abc123def
Start Time: 2026-02-15T06:30:00.000Z
End Time: 2026-02-15T06:35:00.000Z

SYSTEM INFORMATION:
--------------------------------------------------------------------------------
userAgent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...
platform: MacIntel
language: en-US
screenResolution: 1920x1080
windowSize: 1280x720
url: http://localhost:8080/
timestamp: 2026-02-15T06:35:00.000Z

SUMMARY:
--------------------------------------------------------------------------------
Total Entries: 15
Errors: 3
Warnings: 2

ERROR LOG:
================================================================================

[1] 2026-02-15T06:30:15.123Z - ERROR
Message: API Error
Details:
  endpoint: /projects/create
  error: Network request failed
  requestData: {"name":"Test Project","settings":{"fps":30}}
  
--------------------------------------------------------------------------------

[2] 2026-02-15T06:31:20.456Z - WARNING
Message: Console Warning
Details:
  message: Backend not available, using mock templates
  
--------------------------------------------------------------------------------
```

### Download as JSON
**Best for**: Automated processing, detailed analysis

1. Click **"Download as JSON"**
2. File saves as: `lapaas-error-log-YYYY-MM-DD-HH-MM-SS.json`
3. Can be parsed programmatically

**Example Output**:
```json
{
  "sessionId": "session-1708012345678-abc123def",
  "startTime": "2026-02-15T06:30:00.000Z",
  "endTime": "2026-02-15T06:35:00.000Z",
  "systemInfo": {
    "userAgent": "Mozilla/5.0...",
    "platform": "MacIntel",
    "language": "en-US",
    "screenResolution": "1920x1080",
    "windowSize": "1280x720",
    "url": "http://localhost:8080/"
  },
  "errorCount": 3,
  "warningCount": 2,
  "totalEntries": 15,
  "errors": [
    {
      "timestamp": "2026-02-15T06:30:15.123Z",
      "level": "error",
      "message": "API Error",
      "details": {
        "endpoint": "/projects/create",
        "error": "Network request failed"
      },
      "sessionId": "session-1708012345678-abc123def"
    }
  ]
}
```

### Copy to Clipboard
**Best for**: Quick sharing in chat, forums

1. Click **"Copy to Clipboard"**
2. Alert confirms: "Error log copied to clipboard!"
3. Paste (Cmd+V / Ctrl+V) anywhere

## What Gets Logged

### Errors (Red)
- API call failures
- Network errors
- JavaScript exceptions
- Project creation failures
- Media import failures
- AI editing failures

### Warnings (Orange)
- Console warnings
- Deprecated API usage
- Missing optional features

### Info (White)
- Session start
- User actions (button clicks)
- API calls
- Successful operations
- Log downloads/copies

## Logged User Actions

The system automatically logs:
- **Project Creation**: Name, FPS, settings
- **Media Import**: File selection, project ID
- **AI Editing**: Start, transcription, template placement
- **API Calls**: Command, arguments, response
- **Template Clicks**: Template ID, action
- **Tool Selection**: Which tool activated

## Managing Logs

### Clear Log
1. Click **"Clear Log"** button (red)
2. Confirm: "Clear all error logs?"
3. All entries removed (session continues)

### Session Management
- Each browser/app session gets unique ID
- Logs persist during session
- Cleared on page refresh (unless downloaded)
- Max 100 entries (oldest removed automatically)

## Sharing Error Logs

### When Reporting Issues

**Include**:
1. ✅ Error log file (text or JSON)
2. ✅ Session ID
3. ✅ Steps to reproduce
4. ✅ Expected vs actual behavior

**Example Issue Report**:
```
**Issue**: Project creation fails with network error

**Steps to Reproduce**:
1. Click "New Project"
2. Enter "Test Project"
3. Enter "30" for FPS
4. Click OK

**Expected**: Project created successfully
**Actual**: Error alert: "Network request failed"

**Error Log**: Attached lapaas-error-log-2026-02-15.txt
**Session ID**: session-1708012345678-abc123def
**Browser**: Chrome 120.0.6099.109
**OS**: macOS 14.2.1
```

### Via Email
1. Download error log as text file
2. Attach to email
3. Include session ID in email body

### Via GitHub Issue
1. Download error log
2. Create new issue
3. Drag and drop log file
4. Or paste clipboard content in code block:
   ````markdown
   ```
   [paste error log here]
   ```
   ````

### Via Chat/Slack
1. Copy to clipboard
2. Paste in message
3. Format as code block if possible

## Privacy & Security

### What's Included
- ✅ Error messages
- ✅ API endpoints
- ✅ User actions (button clicks)
- ✅ System info (browser, OS)
- ✅ Timestamps

### What's NOT Included
- ❌ Passwords
- ❌ API keys
- ❌ Personal data
- ❌ File contents
- ❌ Video data

### Safe to Share
Error logs are safe to share publicly. They contain only:
- Technical error information
- System configuration
- User interface interactions

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close error log modal |

## Troubleshooting

### "Error log is empty"
- **Cause**: No errors have occurred yet
- **Solution**: This is good! Everything is working

### "Failed to copy to clipboard"
- **Cause**: Browser permission issue
- **Solution**: Use "Download as Text File" instead

### "Badge shows errors but modal is empty"
- **Cause**: Logs were cleared
- **Solution**: Badge updates every 5 seconds, will reset

### "Download doesn't work"
- **Cause**: Browser blocking downloads
- **Solution**: Check browser download settings/permissions

## Best Practices

### For Users
1. **Check error log** before reporting issues
2. **Download immediately** when error occurs
3. **Include session ID** in reports
4. **Clear old logs** periodically

### For Developers
1. **Review logs** before debugging
2. **Check timestamps** to understand sequence
3. **Look for patterns** in repeated errors
4. **Verify system info** matches expected environment

## Technical Details

### Log Entry Format
```javascript
{
  timestamp: "2026-02-15T06:30:15.123Z",  // ISO 8601
  level: "error",                          // error, warning, info
  message: "API Error",                    // Human-readable
  details: {                               // Additional context
    endpoint: "/projects/create",
    error: "Network request failed"
  },
  sessionId: "session-1708012345678-abc123def"
}
```

### Storage
- Stored in memory (not localStorage)
- Cleared on page refresh
- Max 100 entries (FIFO)
- No server upload (privacy)

### Performance
- Minimal overhead (<1ms per log)
- Async operations
- No blocking UI
- Efficient memory usage

## FAQ

**Q: Will error logging slow down the app?**  
A: No, logging has minimal performance impact (<1ms per entry).

**Q: Are logs sent to a server?**  
A: No, all logs stay on your device. You control when/how to share.

**Q: Can I disable error logging?**  
A: Currently no, but it's lightweight and privacy-safe.

**Q: How long are logs kept?**  
A: Until page refresh or manual clear. Max 100 entries.

**Q: What if I have 1000+ errors?**  
A: Only last 100 are kept. Download periodically if needed.

**Q: Can I view logs in console?**  
A: Yes, check browser DevTools console for real-time logs.

## Support

If you encounter issues with error logging itself:
1. Check browser console for errors
2. Try different browser
3. Report to: [support contact]

## Summary

The error logging system helps you:
- ✅ Track what went wrong
- ✅ Share debugging info easily
- ✅ Report issues effectively
- ✅ Help developers fix bugs faster

**Always include error logs when reporting issues!**
