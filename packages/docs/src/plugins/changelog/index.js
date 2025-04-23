const { globSync } = require("glob");
const path = require("path");
const fs = require("fs");
const fm = require("front-matter");

module.exports = function (context, options) {
  return {
    name: "changelog-plugin",
    async loadContent() {
      // load mdx files from ./docs/_changelog/
      const dirPath = path.resolve(__dirname, "../../../docs/_changelog");
      const changelogFiles = globSync(`${dirPath}/*.{md,mdx}`);
      // read each file and parse it
      const fileData = changelogFiles.map((filePath) => {
        return fs.readFileSync(filePath, "utf-8");
      });
      // parse front matter
      const parsedData = fileData.map((file) => {
        const { attributes, body } = fm(file);
        return {
          ...attributes,
          content: body,
        };
      });
      return parsedData;
    },
    async contentLoaded({ content, actions }) {
      const { setGlobalData } = actions;
      setGlobalData({ changelog: content });
    },
  };
};
