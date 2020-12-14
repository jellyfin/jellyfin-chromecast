/* eslint-env node */
'use strict';

const { merge } = require('webpack-merge');

const devConfig = require('./webpack.dev.js');

module.exports = merge(devConfig, {
    watch: true,
    watchOptions: {
        ignored: '/node_modules/**'
    }
});
