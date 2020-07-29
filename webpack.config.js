const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require("webpack");

let config = {
    context: path.resolve(__dirname, "src"),
    entry: "./app.ts",
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [ '.ts', '.js' ],
    },
    externals: {
        "chromecast-caf-receiver/cast.framework": "cast.framework",
        "chromecast-caf-receiver/cast.framework.messages": "cast.framework.messages",
    },
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

    if (!isProduction) {
        config.devtool = "#inline-source-map";
    }

    return config;
};
