/* eslint-env node */
'use strict';

const webpack = require('webpack');
const { merge } = require('webpack-merge');

const packagejson = require('./package.json');
const commonConfig = require('./webpack.common.js');

module.exports = merge(commonConfig, {
    mode: 'development',
    devtool: 'inline-source-map',
    plugins: [
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(false),
            RECEIVERVERSION: JSON.stringify(packagejson.version)
        })
    ]
});
