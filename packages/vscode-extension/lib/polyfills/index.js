module.exports = {
  get TextDecoder() {
    if (global.TextDecoder !== undefined) {
      return global.TextDecoder;
    }
    return require("./third-party/text_decoder").TextDecoder;
  },
};
