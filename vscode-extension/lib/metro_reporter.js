class JsonReporter {
  constructor(terminal) {}

  update(event) {
    // There is a special case for errors because they have non-enumerable fields.
    if (Object.prototype.toString.call(event.error) === "[object Error]") {
      event = Object.assign(event, {
        message: event.error.message,
        stack: event.error.stack,
      });
    }
    process.stdout.write(JSON.stringify(event) + "\n");
  }
}
module.exports = JsonReporter;
