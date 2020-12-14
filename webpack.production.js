/* eslint-env node */
'use strict';

const path = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');

const packagejson = require('./package.json');
const commonConfig = require('./webpack.common.js');

module.exports = merge(commonConfig, {
    mode: 'production',
    plugins: [
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(true),
            RECEIVERVERSION: JSON.stringify(packagejson.version)
        })
    ]
});
