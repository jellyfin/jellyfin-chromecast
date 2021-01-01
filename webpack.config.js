/* eslint @typescript-eslint/no-var-requires: "off" */
const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ImageMinimizerPlugin = require('image-minimizer-webpack-plugin');
const packagejson = require('./package.json');

const config = {
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
        new CopyWebpackPlugin({
            patterns: [{ from: 'locales', to: 'locales' }]
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
    },
    experiments: {
        topLevelAwait: true
    }
};

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    config.plugins.push(
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(isProduction),
            RECEIVERVERSION: JSON.stringify(packagejson.version)
        })
    );

    if (!isProduction) {
        config.devtool = 'inline-source-map';
    }

    return config;
};
