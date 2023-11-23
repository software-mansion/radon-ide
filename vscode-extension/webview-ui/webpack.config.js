const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    resolve: {
        extensions: ['.js', '.jsx']
    },
    output: {
      path: path.join(__dirname, "/build"), // the bundle output path
      filename: "bundle.js", // the name of the bundle
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "src/index.html", // to import index.html file inside index.js
      }),
    ],
    devServer: {
      port: 3000, // you can change the port
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
          test: /\.(js|jsx)$/, // .js and .jsx files
          exclude: /node_modules/, // excluding the node_modules folder
          use: {
            loader: "babel-loader",
          },
        },
        {
            test: /\.css$/, // will only match .css files
            use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(png|woff|woff2|eot|ttf|svg)$/, // to import images and fonts
          loader: "url-loader",
          options: { limit: false },
        },
      ],
    },
  };