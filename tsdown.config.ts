import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	outDir: 'dist',
	deps: {
		neverBundle: [
			'fs',
			'path',
			'url',
			'util',
			'events',
			'vm',
			'os',
			'http',
			'https',
			'stream',
			'zlib',
			'crypto',
			'net',
			'tls',
			'assert',
			'child_process',
			'vite',
		],
	},
	target: false,
});
