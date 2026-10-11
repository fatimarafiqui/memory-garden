import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths so the build works at any URL path (e.g. /memory-garden/ on GitHub Pages).
export default defineConfig({ base: './', plugins: [react()] })
