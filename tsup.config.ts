import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	splitting: false,
	sourcemap: true,
	outDir: 'dist',
	external: ['fs', 'path', 'url', 'util', 'events', 'vm', 'os', 'http', 'https', 'stream', 'zlib', 'crypto', 'net', 'tls', 'assert', 'child_process', 'vite'],
});
