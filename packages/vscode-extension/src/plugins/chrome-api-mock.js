const vscode = acquireVsCodeApi();
window.chrome = {
  storage: {},
  runtime: {
    sendMessage: (...args) => {
      const message = args.lenght > 1 ? args[1] : args[0];
      vscode.postMessage(message);
    },
    connect: () => {
      return {
        onMessage: {
          addListener: (callback) => {
            window.addEventListener("message", (ev) => {
              const payload = ev.data;
              if (payload.scope === "RNIDE-redux-devtools") {
                callback(payload.data);
              }
            });
          },
        },
        postMessage: (...args) => {
          const message = args.lenght > 1 ? args[1] : args[0];
          vscode.postMessage(message);
        },
      };
    },
  },
};
