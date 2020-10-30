const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require("webpack");

let config = {
    context: path.resolve(__dirname, "src"),
    entry: "./app.js",
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist")
    },
    resolve: {
        extensions: [".webpack.js", ".web.js", ".ts", ".js"]
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin([{
            from: "**/*",
            to: ".",
            ignore: ['*.js']
        }])
    ],
    module: {
        rules: [
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
