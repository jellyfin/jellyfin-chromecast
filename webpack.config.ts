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
    output: {
        filename: '[name].[fullhash].js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: './'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    plugins: [
        // @ts-expect-error - Typings mismatch between versions
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: 'index.html',
            hash: false,
            favicon: 'favicon.ico'
        }),
        new ImageMinimizerPlugin({
            minimizerOptions: {
                plugins: [
                    [
                        'svgo',
                        {
                            plugins: [
                                {
                                    removeComments: false
                                }
                            ]
                        }
                    ]
                ]
            }
        })
    ],
    module: {
        rules: [
            { test: /\.html$/, loader: 'html-loader' },
            {
                test: /\.(png|svg|jpg|gif)$/,
                use: 'file-loader'
            },
            {
                test: /\.(ttf|eot|woff(2)?)(\?[a-z0-9=&.]+)?$/,
                loader: 'file-loader'
            },
            { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
            { test: /\.tsx?$/, loader: 'ts-loader' },
            { test: /\.js$/, loader: 'source-map-loader' }
        ]
    }
};

const development: webpack.Configuration = {
    mode: 'development',
    devtool: 'inline-source-map',
    // @ts-expect-error - Typings mismatch between versions
    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: true,
        port: process.env.RECEIVER_PORT
            ? Number.parseInt(process.env.RECEIVER_PORT, 10)
            : 9000,
        publicPath: '/'
    },
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
