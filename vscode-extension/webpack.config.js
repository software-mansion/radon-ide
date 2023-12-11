//@ts-check

"use strict";

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const StringReplacePlugin = require("string-replace-webpack-plugin");
const { EnvironmentPlugin } = require("webpack");

const baseConfig = {
  mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  externals: ["vscode", "source-map"],
  resolve: {
    extensions: [".ts", ".js", ".tsx", ".jsx"],
  },
  devtool: "nosources-source-map",
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
  module: {
    rules: [
      {
        test: /\.(tsx?|jsx?)$/,
        exclude: /node_modules/,
        use: [{ loader: "ts-loader" }],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(woff|woff2|eot|ttf|png|jpe?g|gif|mjpeg)$/, // to import images and fonts
        loader: "url-loader",
        options: { limit: false },
      },
    ],
  },
};

const extensionConfig = {
  ...baseConfig,
  target: "node",
  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "out"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      ...baseConfig.module.rules,
      {
        // Test for specific filenames regardless of their paths
        test: (filePath) => {
          return (
            /releaseChecker[\\/]index\.js$/.test(filePath) ||
            /import-fresh[\\/]index\.js$/.test(filePath)
          );
        },
        use: [
          {
            loader: StringReplacePlugin.replace({
              replacements: [
                {
                  // Regex pattern to match require calls where the argument doesn't start with a quote
                  pattern: /require\((?![ '"])/gi,
                  replacement: function (match, offset, string) {
                    return `__non_webpack_require__${match.substring(7)}`;
                  },
                },
              ],
            }),
          },
        ],
      },
    ],
  },
  plugins: [
    new EnvironmentPlugin({
      WS_NO_BUFFER_UTIL: 1,
      WS_NO_UTF_8_VALIDATE: 1,
    }),
    new StringReplacePlugin(),
  ],
};

function webviewConfig(_, options) {
  const config = {
    ...baseConfig,
    target: ["web", "es2020"],
    entry: "./src/webview/index.js",
    output: {
      path: path.resolve(__dirname, "out"),
      filename: "bundle.js",
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/webview/index.html",
      }),
    ],
    devServer: {
      port: 3000,
      allowedHosts: "all",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
      },
    },
  };

  if (options.mode === "production") {
    // replace style-loader with MiniCssExtractPlugin.loader in production
    config.module.rules[1].use = [MiniCssExtractPlugin.loader, "css-loader"];

    config.plugins.push(
      new MiniCssExtractPlugin({
        filename: "main.css",
        chunkFilename: "[id].css",
      })
    );
  }

  return config;
}

module.exports = [extensionConfig, webviewConfig];
