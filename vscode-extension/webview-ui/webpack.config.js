const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (_, options) => {
    const config = {
      resolve: {
          extensions: ['.js', '.jsx']
      },
      output: {
        path: path.join(__dirname, "/build"),
        filename: "bundle.js", 
      },
      plugins: [
        new HtmlWebpackPlugin({
          template: "src/index.html",
        }),
      ],
      devServer: {
        port: 3000,
        allowedHosts: "all",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        }
      },
      module: {
        rules: [
          {
            test: /\.(js|jsx)$/,
            exclude: /node_modules/,
            use: {
              loader: "babel-loader",
            },
          },
          {
            test: /\.css$/,
            use: ["style-loader", "css-loader"],
          },
          {
            test: /\.(woff|woff2|eot|ttf|png|jpe?g|gif|mjpeg)$/, // to import images and fonts
            loader: "url-loader",
            options: { limit: false },
          }
        ],
      },
    }

    if (options.mode === "production") {
      // replace style-loader with MiniCssExtractPlugin.loader in production
      config.module.rules[1].use = [MiniCssExtractPlugin.loader, "css-loader"];

      config.plugins.push(new MiniCssExtractPlugin({
        filename: 'main.css',
        chunkFilename: '[id].css',
      }));
    }

    return config;
  };
