import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  preview: {
    // This tells Vite that your Railway URL is safe!
    allowedHost: ['dependable-charm-production.up.railway.app'],
    host: '0.0.0.0',
    port: process.env.PORT || 8080
  }
})
