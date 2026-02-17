import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    root: '.', // Build from project root
    base: './', // Relative paths for Tauri
    server: {
        port: 1420,
        strictPort: true,
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'safari13', // Tauri specific
        sourcemap: !!process.env.TAURI_DEBUG,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
