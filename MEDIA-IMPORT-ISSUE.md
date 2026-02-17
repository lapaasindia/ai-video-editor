# Media Import Issue - Root Cause & Solution

## The Problem

Media import fails with "Internal server error". The error log shows:
```
input: "14 tech news HDR.m4v"
```

**Root Cause**: The file path is just the filename, not the full absolute path.

## Why This Happens

The Tauri file dialog returns the full path correctly, but somewhere in the process it's being converted to just the filename.

## What the Backend Needs

The `media_ingest.mjs` script uses `ffprobe` to analyze the video file:
```javascript
async function probeMedia(inputPath) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_format', ...], inputPath);
}
```

This requires the **full absolute path** to the file, like:
```
/Users/sahilkhanna/Desktop/14 tech news HDR.m4v
```

Not just:
```
14 tech news HDR.m4v
```

## Backend Logs to Check

When you run the backend (`npm run desktop:backend`), you should now see:
```
[Media Ingest] Processing: 14 tech news HDR.m4v
[Media Ingest] Error: spawn ffprobe ENOENT (or similar)
```

The error will tell us exactly what's failing.

## Solution

### Option 1: Check Backend Logs (RECOMMENDED)

1. Open terminal where backend is running
2. Look for lines starting with `[Media Ingest]`
3. The error message will show the actual problem

Common errors:
- **`ffprobe: command not found`** → Install ffmpeg: `brew install ffmpeg`
- **`ENOENT: no such file or directory`** → File path is wrong
- **`Permission denied`** → File permissions issue

### Option 2: Test with Full Path

In the desktop app console (View → Developer → JavaScript Console):
```javascript
// Test with full path
window.editor.processMediaImport('/Users/sahilkhanna/Desktop/14 tech news HDR.m4v')
```

### Option 3: Install ffmpeg

Most likely the issue is ffmpeg not being installed:
```bash
brew install ffmpeg
```

Then try importing again.

## Debugging Steps

1. **Check if ffmpeg is installed**:
   ```bash
   which ffmpeg
   ffmpeg -version
   ```

2. **Check backend is running**:
   ```bash
   curl http://localhost:43123/health
   ```

3. **Check file exists**:
   ```bash
   ls -la "/Users/sahilkhanna/Desktop/14 tech news HDR.m4v"
   ```

4. **Test ffprobe directly**:
   ```bash
   ffprobe "/Users/sahilkhanna/Desktop/14 tech news HDR.m4v"
   ```

## Expected Behavior

When working correctly:
1. User clicks "Import Video"
2. File picker opens
3. User selects video file
4. Full path sent to backend: `/Users/sahilkhanna/Desktop/14 tech news HDR.m4v`
5. Backend runs ffprobe to analyze video
6. Backend stores media info in project
7. Success message shown

## Current Behavior

1. User clicks "Import Video" ✅
2. File picker opens ✅
3. User selects video file ✅
4. **Only filename sent**: `14 tech news HDR.m4v` ❌
5. Backend tries to run ffprobe on just filename ❌
6. ffprobe fails (file not found) ❌
7. Error: "Internal server error" ❌

## Next Steps

### For You to Do:

1. **Install ffmpeg** (if not installed):
   ```bash
   brew install ffmpeg
   ```

2. **Check backend terminal** when you import a video - look for `[Media Ingest]` logs

3. **Share the backend error** - the actual error message will tell us exactly what's wrong

### What I Need:

Please share the backend terminal output when you try to import a video. Look for lines like:
```
[Media Ingest] Processing: ...
[Media Ingest] Error: ...
```

This will tell us the exact error and we can fix it.

## Temporary Workaround

If you need to test the AI editing workflow without importing:

1. The project already exists (ID: `91a702a2-40bc-4ac0-a794-6f028d3998ea`)
2. You can manually set the input path in the backend
3. Or test with a different video file

## Summary

**Issue**: File path is just filename, not full path  
**Likely Cause**: ffmpeg not installed or file path handling issue  
**Solution**: Install ffmpeg and check backend logs for actual error  
**Status**: Need backend terminal output to diagnose further  

**Please share the backend terminal output when you try to import!**
