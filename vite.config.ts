/* eslint-disable sort-keys */

import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    base: './',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: 'es2015',
        assetsInlineLimit: 0
    },
    esbuild: {
        target: 'es2015'
    },
    server: {
        port: 9000
    }
});
