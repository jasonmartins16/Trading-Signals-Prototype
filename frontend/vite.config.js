import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: process.env.PORT || 8080,
    allowedHosts: ['dependable-charm-production.up.railway.app'],
    cors: true // Add this to allow the browser to talk to it freely
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT || 8080,
    allowedHosts: ['dependable-charm-production.up.railway.app'],
    strictPort: true, // Prevents Vite from trying other ports if 8080 is busy
  }
})
