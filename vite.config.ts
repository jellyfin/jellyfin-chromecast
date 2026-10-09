/* eslint-disable sort-keys */

import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    base: './',
    oxc: {
        target: 'es2015'
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: 'es2015',
        assetsInlineLimit: 0
    },
    server: {
        port: 9000
    }
});
