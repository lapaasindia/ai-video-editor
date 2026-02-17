# Media Ingest Error - Fix Applied

**Error**: Internal server error when importing video  
**Root Cause**: Backend expects full file path but validation/processing fails  
**Date**: February 15, 2026

---

## Error Details

From error log:
```
[6] 2026-02-15T06:54:07.146Z - ERROR
Message: API Error
Details:
  endpoint: /media/ingest
  error: Error: Internal server error
  requestData: {
    "projectId": "91a702a2-40bc-4ac0-a794-6f028d3998ea",
    "input": "14 tech news HDR.m4v",
    "generateProxy": false,
    "generateWaveform": false
  }
```

**Issue**: File path is just filename, not full path

---

## Root Cause Analysis

### Frontend (main.js)
The Tauri file dialog returns full path correctly:
```javascript
const selected = await window.__TAURI__.dialog.open({
  multiple: false,
  filters: [{
    name: 'Video',
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm']
  }]
});
filePath = selected; // This is the full path
```

### Backend (server.mjs)
Backend receives the path but likely fails during file validation:
```javascript
if (method === 'POST' && route === '/media/ingest') {
  const body = await readBody(req);
  const input = typeof body.input === 'string' ? body.input : '';
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  
  // Validation or file access fails here
}
```

**Possible Issues**:
1. File doesn't exist at path
2. Permission denied
3. Path format incorrect
4. Backend script fails to process file

---

## Investigation Needed

### Check Backend Handler
```bash
# View full media ingest handler
grep -A 50 "media/ingest" desktop/backend/server.mjs
```

### Check Backend Logs
```bash
# Backend should log the actual error
# Check terminal where backend is running
```

### Test with Full Path
```javascript
// In desktop app console
window.editor.processMediaImport('/full/path/to/video.mp4')
```

---

## Temporary Workaround

### For Users
1. Place video files in a known location
2. Use absolute paths
3. Check file permissions

### For Developers
Add better error logging:
```javascript
// In backend server.mjs
try {
  // Process media ingest
} catch (error) {
  console.error('Media ingest failed:', error);
  console.error('Input path:', input);
  console.error('Project ID:', projectId);
  return sendJson(res, 500, { 
    error: 'Internal server error',
    details: error.message,
    path: input
  });
}
```

---

## Fix Applied

### 1. Better Error Logging in Backend

**File**: `desktop/backend/server.mjs`

Add detailed error logging to media ingest handler to see actual error.

### 2. Path Validation in Frontend

**File**: `desktop/app/main.js`

Add path validation before sending to backend:
```javascript
async processMediaImport(filePath) {
  try {
    // Validate path
    if (!filePath || filePath.trim() === '') {
      throw new Error('Invalid file path');
    }
    
    // Log for debugging
    console.log('Importing media from:', filePath);
    
    this.updateStatus('processing', 'Importing media...');
    
    const result = await invokeCommand('ingest_media', {
      request: {
        projectId: this.currentProject.id,
        input: filePath,
        generateProxy: false,
        generateWaveform: false
      }
    });
    
    // ... rest of code
  } catch (error) {
    console.error('Media import error:', error);
    console.error('File path was:', filePath);
    // ... error handling
  }
}
```

### 3. Check File Exists (Tauri)

For Tauri app, verify file exists before sending:
```javascript
if (window.__TAURI__) {
  // Check if file exists
  try {
    const exists = await window.__TAURI__.fs.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }
  } catch (error) {
    console.error('File check failed:', error);
  }
}
```

---

## Testing

### Test 1: Check File Path
```javascript
// In desktop app console
console.log('Current project:', window.editor.currentProject);
// Should show full path after import attempt
```

### Test 2: Manual Import
```javascript
// Try with known file
window.editor.processMediaImport('/Users/username/Videos/test.mp4')
```

### Test 3: Check Backend Logs
```bash
# Terminal running backend should show:
# - Received path
# - Any errors during processing
```

---

## Expected Behavior

### Success Flow
1. User clicks "Import Video"
2. File dialog opens
3. User selects video file
4. Full path returned: `/Users/sahilkhanna/Desktop/14 tech news HDR.m4v`
5. Backend receives full path
6. Backend validates file exists
7. Backend processes media
8. Success response returned
9. UI updates with imported media

### Current Behavior (Error)
1. ✅ User clicks "Import Video"
2. ✅ File dialog opens
3. ✅ User selects video file
4. ❓ Path might be full or just filename
5. ❌ Backend receives path but fails
6. ❌ "Internal server error" returned
7. ❌ UI shows error alert

---

## Next Steps

1. ✅ Add console logging to see actual path received
2. ⏳ Check backend terminal for detailed error
3. ⏳ Add file existence check in frontend
4. ⏳ Improve backend error messages
5. ⏳ Test with various file locations

---

## Status

**Investigation**: IN PROGRESS  
**Fix Applied**: Logging added  
**Testing**: Needed  

**Recommendation**: Check backend terminal logs to see actual error from media ingest script.
