import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';

const execFile = promisify(execFileCb);

async function main() {
    const prompt = process.argv[2];
    const outputPath = process.argv[3];

    if (!prompt || !outputPath) {
        console.error("Usage: node generate_image.mjs <prompt> <output_path>");
        process.exit(1);
    }

    const pythonScript = `
import torch
from diffusers import DiffusionPipeline

device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

# pipe = DiffusionPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float32, use_safetensors=True, variant="fp16")
# Use SD 1.5 for better compatibility/speed on consumer hardware
pipe = DiffusionPipeline.from_pretrained("runwayml/stable-diffusion-v1-5", torch_dtype=torch.float32, use_safetensors=True)
pipe.to(device)

# Recommended for MPS to avoid memory issues
pipe.enable_attention_slicing()

# Fix for MPS NaN issues with VAE in float16
# pipe.vae.to(torch.float32) # No longer needed if whole pipe is float32

prompt = "${prompt.replace(/"/g, '\\"')}"
image = pipe(prompt).images[0]
image.save("${outputPath.replace(/"/g, '\\"')}")
print("Image saved.")
`;

    console.log("Starting image generation...");
    try {
        const { stdout, stderr } = await execFile('python3', ['-c', pythonScript], { maxBuffer: 1024 * 1024 * 10 });
        console.log(stdout);
        if (stderr) console.error(stderr);
    } catch (e) {
        console.error("Image generation failed:", e);
        process.exit(1);
    }
}

main();
