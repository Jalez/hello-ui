import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// When served under a path (e.g. /drawboard) set VITE_BASE_PATH so assets load correctly.
// Otherwise the browser requests /assets/... from the site root and gets 503.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
	server: {
		host: true,
		port: 3500,
		strictPort: true,
		cors: false,
		watch: {
			usePolling: true
		}
	}
})
