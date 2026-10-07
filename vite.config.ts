/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { stuffsPlugin } from './src/server/stuffs-plugin';

export default defineConfig({
  plugins: [react(), stuffsPlugin()],
  server: {
    // Les écritures dans stuffs/ ne doivent pas déclencher de rechargement.
    watch: { ignored: ['**/stuffs/**'] },
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
