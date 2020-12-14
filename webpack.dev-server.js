/* eslint-env node */
'use strict';

const path = require('path');
const { merge } = require('webpack-merge');

const devConfig = require('./webpack.dev.js');

module.exports = merge(devConfig, {
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: process.env.RECEIVER_PORT || 9000,
        publicPath: '/'
    }
});
