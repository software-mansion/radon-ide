const vscode = acquireVsCodeApi();
window.chrome = {
  runtime: {
    sendMessage: (...args) => {
      const message = args.lenght > 1 ? args[1] : args[0];
      vscode.postMessage(message);
    },
    connect: () => {
      const listeners = [];
      window.addEventListener("message", (ev) => {
        const payload = ev.data;
        listeners.slice().forEach((listener) => listener(payload));
      });
      return {
        onMessage: {
          addListener(callback) {
            listeners.push(callback);
          },
          removeListener(callback) {
            const idx = listeners.indexOf(callback);
            if (idx !== -1) {
              listeners.splice(idx, 1);
            }
          },
        },
        postMessage: (...args) => {
          const message = args.lenght > 1 ? args[1] : args[0];
          vscode.postMessage(message);
        },
      };
    },
  },
  storage: {},
  tabs: {
    query() {},
  },
};
