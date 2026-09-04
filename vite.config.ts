import { defineConfig } from 'vite';

// clearScreen/strictPort mengikuti anjuran Tauri agar log Rust tidak tertimpa
export default defineConfig({
  base: './',
  clearScreen: false,
  server: { port: 5189, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: { target: 'es2022', minify: 'esbuild', sourcemap: false },
});
