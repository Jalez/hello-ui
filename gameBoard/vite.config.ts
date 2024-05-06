/** @format */

import react from '@vitejs/plugin-react';
import { defineConfig, splitVendorChunkPlugin } from 'vite';
// import ImportMetaEnvPlugin from '@import-meta-env/unplugin';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),

		// ImportMetaEnvPlugin.vite({
		// 	example: '.env.example',
		// }),

    splitVendorChunkPlugin(),
	],
	server: {
		host: true,
		port: 3000,
		strictPort: true,
		cors: false,
		watch: {
			usePolling: true
		}
	}
});
