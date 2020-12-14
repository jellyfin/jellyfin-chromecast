/* eslint @typescript-eslint/no-var-requires: "off" */
'use strict';

const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');

module.exports = {
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
