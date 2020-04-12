const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require("webpack");

let config = {
    context: path.resolve(__dirname, "src"),
    entry: "./app.js",
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin([{
            from: "**/*",
            to: ".",
            ignore: ['*.js']
        }])
    ]
};

module.exports = (env, argv) => {
    const isProduction = (argv.mode === "production");

    config.plugins.push(
        new webpack.DefinePlugin({
            PRODUCTION: JSON.stringify(isProduction)
        })
    );

    return config;
};
