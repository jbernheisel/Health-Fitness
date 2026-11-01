import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built site run from any sub-path (e.g. GitHub Pages /health-fitness/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2019', sourcemap: false },
});
