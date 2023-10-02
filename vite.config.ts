/* eslint-disable sort-keys */

import { defineConfig } from 'vite';
import { version } from './package.json';

export default defineConfig({
    root: 'src',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: 'es2015',
        assetsInlineLimit: 0
    },
    server: {
        port: 9000
    },
    define: {
        RECEIVERVERSION: JSON.stringify(version)
    }
});
