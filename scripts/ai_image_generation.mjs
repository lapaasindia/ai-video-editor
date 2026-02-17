#!/usr/bin/env node

/**
 * AI Image Generation for Video Editing
 * Generates images based on video content using local AI models
 */

import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Generate image prompt from video context
 * @param {Object} context - Video context (transcript, scene description)
 * @returns {Promise<string>} - Image generation prompt
 */
async function generateImagePrompt(context) {
  const { transcript, timestamp, sceneType = 'general' } = context;
  
  // Use Qwen2.5 to create image prompt
  const prompt = `Based on this video content, create a detailed image generation prompt:

Video transcript: "${transcript}"
Scene type: ${sceneType}
Timestamp: ${timestamp}

Generate a concise, visual prompt for image generation (max 100 words). Focus on:
- Visual elements and composition
- Style and mood
- Colors and lighting
- Avoid text or words in the image

Prompt:`;

  return new Promise((resolve, reject) => {
    const ollama = spawn('ollama', ['run', 'qwen2.5:7b', prompt]);
    let output = '';
    
    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ollama.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Ollama exited with code ${code}`));
      }
    });
    
    ollama.on('error', reject);
  });
}

/**
 * Analyze video frame using vision model
 * @param {string} imagePath - Path to video frame
 * @returns {Promise<Object>} - Scene analysis
 */
async function analyzeFrame(imagePath) {
  return new Promise((resolve, reject) => {
    const ollama = spawn('ollama', [
      'run',
      'llava:7b',
      'Describe this image in detail. Focus on: objects, people, setting, mood, colors.',
      '--image',
      imagePath
    ]);
    
    let output = '';
    
    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ollama.on('close', (code) => {
      if (code === 0) {
        resolve({
          description: output.trim(),
          timestamp: new Date().toISOString()
        });
      } else {
        reject(new Error(`LLaVA exited with code ${code}`));
      }
    });
    
    ollama.on('error', reject);
  });
}

/**
 * Generate image using Stable Diffusion (placeholder for local SD)
 * @param {string} prompt - Image generation prompt
 * @param {Object} options - Generation options
 * @returns {Promise<string>} - Path to generated image
 */
async function generateImage(prompt, options = {}) {
  const {
    width = 1024,
    height = 1024,
    steps = 20,
    outputDir = './output/generated-images'
  } = options;
  
  // Create output directory
  await mkdir(outputDir, { recursive: true });
  
  const timestamp = Date.now();
  const outputPath = join(outputDir, `generated-${timestamp}.png`);
  
  console.log(`[AI Image Gen] Generating image with prompt: "${prompt}"`);
  console.log(`[AI Image Gen] Output: ${outputPath}`);
  
  // TODO: Integrate with local Stable Diffusion
  // For now, return placeholder info
  // In production, this would call:
  // - ComfyUI API
  // - Automatic1111 API
  // - MLX Stable Diffusion
  // - Or other local SD implementation
  
  const imageInfo = {
    prompt,
    width,
    height,
    steps,
    outputPath,
    timestamp,
    status: 'pending',
    note: 'Stable Diffusion integration pending. Use ComfyUI or A1111 API.'
  };
  
  // Save image info
  await writeFile(
    join(outputDir, `generated-${timestamp}.json`),
    JSON.stringify(imageInfo, null, 2)
  );
  
  return imageInfo;
}

/**
 * Suggest images for video timeline
 * @param {Object} videoData - Video data with transcript
 * @returns {Promise<Array>} - Suggested image placements
 */
async function suggestImagesForVideo(videoData) {
  const { transcript, duration, projectId } = videoData;
  
  // Use Llama 3.2 to identify moments needing visuals
  const analysisPrompt = `Analyze this video transcript and suggest 3-5 moments where AI-generated images would enhance the content:

Transcript: "${transcript}"
Duration: ${duration} seconds

For each suggestion, provide:
1. Timestamp (in seconds)
2. Brief description of what image to generate
3. Duration the image should be shown (2-5 seconds)

Format as JSON array.`;

  return new Promise((resolve, reject) => {
    const ollama = spawn('ollama', ['run', 'llama3.2:3b', analysisPrompt]);
    let output = '';
    
    ollama.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ollama.on('close', async (code) => {
      if (code === 0) {
        try {
          // Extract JSON from output
          const jsonMatch = output.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            
            // Generate prompts for each suggestion
            const enrichedSuggestions = await Promise.all(
              suggestions.map(async (suggestion) => {
                const prompt = await generateImagePrompt({
                  transcript: suggestion.description,
                  timestamp: suggestion.timestamp,
                  sceneType: 'b-roll'
                });
                
                return {
                  ...suggestion,
                  generatedPrompt: prompt,
                  projectId
                };
              })
            );
            
            resolve(enrichedSuggestions);
          } else {
            resolve([]);
          }
        } catch (error) {
          console.error('[AI Image Gen] Failed to parse suggestions:', error);
          resolve([]);
        }
      } else {
        reject(new Error(`Llama exited with code ${code}`));
      }
    });
    
    ollama.on('error', reject);
  });
}

/**
 * Main function for CLI usage
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'suggest') {
    // Suggest images for video
    const transcript = args[1] || 'Sample video about technology and innovation';
    const duration = parseInt(args[2]) || 60;
    
    console.log('[AI Image Gen] Analyzing video for image suggestions...');
    const suggestions = await suggestImagesForVideo({
      transcript,
      duration,
      projectId: 'test'
    });
    
    console.log('\n[AI Image Gen] Suggestions:');
    console.log(JSON.stringify(suggestions, null, 2));
    
  } else if (command === 'generate') {
    // Generate single image
    const prompt = args[1] || 'A beautiful landscape with mountains and sunset';
    const imageInfo = await generateImage(prompt);
    
    console.log('\n[AI Image Gen] Image generation queued:');
    console.log(JSON.stringify(imageInfo, null, 2));
    
  } else if (command === 'analyze') {
    // Analyze frame
    const imagePath = args[1];
    if (!imagePath) {
      console.error('Usage: node ai_image_generation.mjs analyze <image-path>');
      process.exit(1);
    }
    
    console.log('[AI Image Gen] Analyzing frame...');
    const analysis = await analyzeFrame(imagePath);
    
    console.log('\n[AI Image Gen] Frame analysis:');
    console.log(JSON.stringify(analysis, null, 2));
    
  } else {
    console.log(`
AI Image Generation for Video Editing

Usage:
  node ai_image_generation.mjs suggest "<transcript>" <duration>
    - Suggest images for video based on transcript
    
  node ai_image_generation.mjs generate "<prompt>"
    - Generate single image from prompt
    
  node ai_image_generation.mjs analyze <image-path>
    - Analyze video frame with vision model

Examples:
  node ai_image_generation.mjs suggest "Welcome to our tech tutorial" 60
  node ai_image_generation.mjs generate "Abstract AI neural network visualization"
  node ai_image_generation.mjs analyze ./frame-001.jpg
`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('[AI Image Gen] Error:', error);
    process.exit(1);
  });
}

// Export functions for use in other scripts
export {
  generateImagePrompt,
  analyzeFrame,
  generateImage,
  suggestImagesForVideo
};
