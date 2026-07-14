import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Load env file based on `mode` in the current working directory.
	const env = loadEnv(mode, process.cwd(), '');
	
	return {
		plugins: [sveltekit()],
		server: {
			host: true,
			port: 5173
		},
		// Make env variables available to server-side code
		define: {
			'process.env.USB_SERIAL_PORT': JSON.stringify(env.USB_SERIAL_PORT),
			'process.env.USB_BAUD_RATE': JSON.stringify(env.USB_BAUD_RATE),
		},
		// Prevent Vite from trying to bundle Node-only packages for the browser
		optimizeDeps: {
			exclude: ['node-mavlink', 'serialport', '@serialport/bindings-cpp']
		},
		ssr: {
			noExternal: [],
			external: ['node-mavlink', 'serialport', '@serialport/bindings-cpp']
		}
	};
});
