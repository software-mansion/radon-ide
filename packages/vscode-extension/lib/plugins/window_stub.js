export function createWindowStub(overrides) {
  const listeners = [];

  function callListeners(message) {
    listeners.slice().forEach((listener) => {
      listener({
        source: window,
        data: message,
      });
    });
  }

  const windowOverrides = {
    addEventListener: (type, listener, options) => {
      if (type !== "message") {
        return;
      }
      if (options === false) {
        if (listeners.indexOf(listener) !== -1) {
          return;
        }
      }
      listeners.push(listener);
    },
    removeEventListener: (type, listener) => {
      if (type !== "message") {
        return;
      }
      listeners.splice(listeners.indexOf(listener), 1);
    },
    postMessage: (message) => {
      callListeners(message);
    },
    ...overrides,
  };

  const window = new Proxy(globalThis, {
    get(target, prop, receiver) {
      if (prop in windowOverrides) {
        return windowOverrides[prop];
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  return window;
}
