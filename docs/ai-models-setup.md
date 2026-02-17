# AI Models Setup Guide

## Installed Models

### 1. **Llama 3.2 3B** ✅ INSTALLED
- **Purpose**: Cut planning (deciding what to keep/remove from video)
- **Runtime**: Ollama
- **Size**: 2.0 GB
- **Optimized**: Apple Silicon with Metal acceleration
- **Usage**: Analyzes transcripts to create rough cuts

### 2. **Qwen2.5 7B** ⏳ INSTALLING
- **Purpose**: Template planning (selecting best templates for content)
- **Runtime**: Ollama
- **Size**: 4.7 GB
- **Optimized**: Apple Silicon with Metal acceleration
- **Usage**: Matches video content to appropriate templates

### 3. **LLaVA 7B** ⏳ INSTALLING
- **Purpose**: Vision/image understanding
- **Runtime**: Ollama
- **Size**: ~4.5 GB
- **Optimized**: Apple Silicon with Metal acceleration
- **Usage**: Analyzes video frames, generates image descriptions

### 4. **MLX Whisper** ⏳ INSTALLING
- **Purpose**: Audio transcription
- **Runtime**: MLX (Apple's ML framework)
- **Size**: ~3 GB (model downloaded on first use)
- **Optimized**: Apple Silicon with Metal acceleration
- **Usage**: Converts speech to text with timestamps

## System Requirements

✅ **Your System**: Apple Silicon (arm64) macOS
- **CPU**: Apple M-series chip
- **RAM**: 16GB+ recommended
- **Storage**: ~15GB for all models
- **Acceleration**: Metal (GPU acceleration)

## Installed Runtimes

✅ **Ollama 0.15.6**
- Local LLM runtime
- Manages model downloads and serving
- Runs as background service

✅ **MLX 0.30.5**
- Apple's ML framework
- Optimized for Apple Silicon
- Used for Whisper transcription

✅ **Python 3.14**
- Required for MLX Whisper
- Installed via Homebrew

## Model Capabilities

### Cut Planning (Llama 3.2 3B)
**Input**: Video transcript with timestamps
**Output**: List of segments to keep/remove
**Example**:
```json
{
  "keep": [
    {"start": "00:00:10", "end": "00:00:45", "reason": "Key introduction"},
    {"start": "00:01:20", "end": "00:02:30", "reason": "Main content"}
  ],
  "remove": [
    {"start": "00:00:45", "end": "00:01:20", "reason": "Filler words"}
  ]
}
```

### Template Planning (Qwen2.5 7B)
**Input**: Video content description, transcript
**Output**: Recommended templates with timing
**Example**:
```json
{
  "templates": [
    {
      "id": "tech-news-1",
      "placement": "00:00:05",
      "duration": "5s",
      "text": "Breaking: New AI Model Released"
    }
  ]
}
```

### Vision Understanding (LLaVA 7B)
**Input**: Video frame image
**Output**: Detailed description
**Example**:
```json
{
  "description": "A person presenting in front of a whiteboard with diagrams",
  "objects": ["person", "whiteboard", "markers"],
  "scene": "office/classroom",
  "mood": "professional"
}
```

### Transcription (MLX Whisper)
**Input**: Audio file
**Output**: Transcript with timestamps
**Example**:
```json
{
  "segments": [
    {
      "start": 0.0,
      "end": 3.5,
      "text": "Welcome to this tutorial"
    }
  ]
}
```

## AI Image Generation Integration

### NEW: AI-Generated Images in Editing

We're adding AI image generation to enhance your videos:

**Use Cases**:
1. **B-roll generation**: Create images for topics mentioned
2. **Title cards**: Generate custom backgrounds
3. **Transitions**: Create smooth visual transitions
4. **Stock replacement**: Generate images instead of stock photos

**Workflow**:
```
1. Analyze transcript → Find topics needing visuals
2. Generate prompts → Create image descriptions
3. Generate images → Use local Stable Diffusion
4. Place in timeline → Auto-insert at relevant timestamps
```

**Example**:
```
Transcript: "Let's talk about artificial intelligence..."
→ Generate image: "Abstract visualization of AI neural networks"
→ Place at timestamp: 00:00:15
→ Duration: 3 seconds
```

## Testing Models

### Test Llama 3.2 3B
```bash
ollama run llama3.2:3b "Analyze this transcript and suggest cuts: 'Hello everyone, um, so today we're going to, uh, talk about AI.'"
```

### Test Qwen2.5 7B
```bash
ollama run qwen2.5:7b "Given a tech tutorial video, suggest 3 appropriate templates"
```

### Test LLaVA 7B
```bash
ollama run llava:7b "Describe this image" --image /path/to/frame.jpg
```

### Test MLX Whisper
```bash
mlx_whisper /path/to/audio.mp3 --model large-v3
```

## Model Management

### List Installed Models
```bash
ollama list
```

### Remove a Model
```bash
ollama rm llama3.2:3b
```

### Update a Model
```bash
ollama pull llama3.2:3b
```

### Check Ollama Status
```bash
brew services list | grep ollama
```

### Restart Ollama
```bash
brew services restart ollama
```

## Performance Optimization

### Ollama Environment Variables
```bash
# Enable flash attention (faster inference)
export OLLAMA_FLASH_ATTENTION=1

# Quantize KV cache (lower memory)
export OLLAMA_KV_CACHE_TYPE=q8_0

# Set GPU layers (all layers on GPU)
export OLLAMA_NUM_GPU=999
```

### MLX Optimization
MLX automatically uses Metal acceleration - no configuration needed!

## Troubleshooting

### "Ollama not found"
```bash
brew services restart ollama
# Wait 5 seconds
ollama list
```

### "Model download failed"
```bash
# Check internet connection
# Retry download
ollama pull llama3.2:3b
```

### "Out of memory"
- Close other applications
- Use smaller models (3B instead of 7B)
- Reduce batch size in config

### "Slow inference"
- Check Ollama is using GPU: `ollama ps`
- Verify Metal acceleration: `system_profiler SPDisplaysDataType`
- Restart Ollama service

## Integration with Lapaas Editor

### Backend Configuration

Models are automatically detected by:
```bash
npm run models:discover
```

### Using in Workflows

**Start Editing Pipeline**:
```bash
npm run pipeline:start-editing -- \
  --project-id abc123 \
  --input video.mp4 \
  --mode hybrid
```

This will:
1. ✅ Transcribe with MLX Whisper
2. ✅ Plan cuts with Llama 3.2
3. ✅ Select templates with Qwen2.5
4. ✅ Analyze frames with LLaVA (if enabled)
5. ✅ Generate images (if enabled)

## Model Comparison

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| Llama 3.2 3B | 2GB | Fast | Good | Cut planning |
| Qwen2.5 7B | 4.7GB | Medium | Excellent | Template selection |
| LLaVA 7B | 4.5GB | Medium | Good | Image understanding |
| MLX Whisper | 3GB | Fast | Excellent | Transcription |

## Next Steps

1. ✅ Wait for all models to finish downloading
2. ✅ Test each model individually
3. ✅ Run complete AI editing workflow
4. ✅ Enable AI image generation
5. ✅ Fine-tune model parameters

## Advanced: Custom Models

### Add Your Own Model
```bash
# Pull from Ollama library
ollama pull <model-name>

# Or create custom Modelfile
ollama create my-model -f Modelfile
```

### Modelfile Example
```
FROM llama3.2:3b
PARAMETER temperature 0.7
PARAMETER top_p 0.9
SYSTEM "You are a video editing assistant."
```

## Resources

- **Ollama**: https://ollama.ai
- **MLX**: https://github.com/ml-explore/mlx
- **MLX Whisper**: https://github.com/ml-explore/mlx-examples/tree/main/whisper
- **Model Library**: https://ollama.ai/library

## Summary

✅ **4 AI models** for complete video editing workflow
✅ **Optimized** for Apple Silicon with Metal
✅ **Local** - no cloud API costs
✅ **Fast** - GPU-accelerated inference
✅ **Private** - all processing on your device

**Total Download Size**: ~15 GB
**Total RAM Usage**: ~8-12 GB during inference
**Inference Speed**: 20-50 tokens/second on M1/M2/M3
