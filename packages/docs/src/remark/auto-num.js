const visit = require("unist-util-visit");

const plugin = (options) => {
  const transformer = async (ast) => {
    let number = 1;
    visit(ast, "heading", (node) => {
      if (node.children.length > 0) {
        node.children.forEach((child) => {
          if (child.value.includes("-sec-num-")) {
            child.value = child.value.replace("-sec-num-", `${number}.`);
            number++;
          }
        });
      }
    });
  };
  return transformer;
};

module.exports = plugin;
