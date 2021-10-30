/* eslint-env node */

import * as path from 'path';
import * as webpack from 'webpack';
import { DefinePlugin } from 'webpack';
import { merge } from 'webpack-merge';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import ImageMinimizerPlugin from 'image-minimizer-webpack-plugin';
import { version } from './package.json';

const common: webpack.Configuration = {
    context: path.resolve(__dirname, 'src'),
    entry: './app.ts',
    module: {
        rules: [
            { loader: 'html-loader', test: /\.html$/ },
            {
                test: /\.(png|svg|jpg|gif)$/,
                type: 'asset/resource'
            },
            {
                test: /\.(ttf|eot|woff(2)?)(\?[a-z0-9=&.]+)?$/,
                type: 'asset/resource'
            },
            { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
            { loader: 'ts-loader', test: /\.tsx?$/ },
            { loader: 'source-map-loader', test: /\.js$/ }
        ]
    },
    output: {
        filename: '[name].[fullhash].js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: './'
    },
    plugins: [
        // @ts-expect-error - Typings mismatch between versions
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            favicon: 'favicon.ico',
            filename: 'index.html',
            hash: false,
            template: 'index.html'
        }),
        new ImageMinimizerPlugin({
            minimizerOptions: {
                plugins: [
                    [
                        'svgo',
                        {
                            plugins: [
                                {
                                    active: false,
                                    name: 'removeComments'
                                }
                            ]
                        }
                    ]
                ]
            }
        })
    ],
    resolve: {
        extensions: ['.ts', '.js']
    }
};

const development: webpack.Configuration = {
    // @ts-expect-error - Typings mismatch between versions
    devServer: {
        compress: true,
        contentBase: path.join(__dirname, 'dist'),
        port: process.env.RECEIVER_PORT
            ? Number.parseInt(process.env.RECEIVER_PORT, 10)
            : 9000,
        publicPath: '/'
    },
    devtool: 'inline-source-map',
    mode: 'development',
    plugins: [
        new DefinePlugin({
            PRODUCTION: JSON.stringify(false),
            RECEIVERVERSION: JSON.stringify(version)
        })
    ]
};

const production: webpack.Configuration = {
    mode: 'production',
    plugins: [
        new DefinePlugin({
            PRODUCTION: JSON.stringify(true),
            RECEIVERVERSION: JSON.stringify(version)
        })
    ]
};

module.exports = (argv: { [key: string]: string }): webpack.Configuration => {
    let config;

    if (argv.mode === 'production') {
        config = merge(common, production);
    } else {
        config = merge(common, development);
    }

    return config;
};
