const vscode = acquireVsCodeApi();

const eventsStub = {
  addListener: function () {},
  removeListener: function () {},
};

window.chrome = {
  runtime: {
    id: "chrome-api-stub-webview",
    sendMessage: (...args) => {
      const message = args.lenght > 1 ? args[1] : args[0];
      vscode.postMessage(message);
    },
    connect: () => {
      const listeners = [];
      window.addEventListener("message", (ev) => {
        const payload = ev.data;
        if (ev.source === window || payload.scope !== "rnide-chrome-stub") {
          return;
        }
        listeners.slice().forEach((listener) => listener(payload.message));
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
        onDisconnect: eventsStub,
        postMessage: (...args) => {
          const message = args.length > 1 ? args[1] : args[0];
          vscode.postMessage(message);
        },
      };
    },
  },
  storage: {},
  tabs: {
    query() {},
  },
  devtools: {
    inspectedWindow: {
      // NOTE: hardcoded tabId, since we don't care about supporting multiple inspected targets at this point
      tabId: 1,
    },
    network: {
      onNavigated: eventsStub,
    },
    panels: {
      // NOTE: we fake creating a separate web context for the panel,
      // instead loading the code directly in the existing webview
      // and triggering the onShown event listener after a short delay
      // to let the panel initialize
      create(name, iconPath, pagePath, callback) {
        const panel = {
          onShown: {
            addListener(cb) {
              setTimeout(() => {
                cb(window);
              }, 100);
            },
            removeListener() {},
          },
          onHidden: eventsStub,
        };
        callback(panel);
      },
    },
  },
};
