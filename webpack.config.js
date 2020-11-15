const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const webpack = require("webpack");
const HtmlWebpackPlugin = require('html-webpack-plugin');

let config = {
    context: path.resolve(__dirname, "src"),
    entry: "./app.ts",
    output: {
        filename: "[name].[fullhash].js",
        path: path.resolve(__dirname, "dist"),
        publicPath: './'
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    plugins: [
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: 'index.html',
            hash: false
        })
    ],
    module: {
        rules: [
            { test: /\.html$/, loader: "html-loader"},
            { test: /\.(svg|png|jpe?g|gif|eot|woff|tff)$/i, loader: "url-loader" },
            { test: /\.css$/i, loader: 'file-loader' },
            { test: /\.tsx?$/, loader: "ts-loader" },
            { test: /\.js$/, loader: "source-map-loader" }
        ]
    }
};

module.exports = (env, argv) => {
    const isProduction = (argv.mode === "production");

    config.plugins.push(
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(isProduction)
        })
    );

    if (!isProduction) {
        config.devtool = "inline-source-map";
    }

    return config;
};
