import { PluginMessageBridge } from "./PluginMessageBridge";

interface ConnectOptions {
  name: string;
}

export function createChromeStub() {
  const runtime = {
    connect(...args: [string, ConnectOptions] | [ConnectOptions]) {
      let extensionId: string | undefined;
      let options: ConnectOptions;
      if (args.length === 1) {
        options = args[0];
      } else {
        extensionId = args[0];
        options = args[1];
      }

      const bridge = new PluginMessageBridge(extensionId);
      global.__RNIDE_register_dev_plugin(extensionId);

      return {
        postMessage(message: unknown) {
          bridge.sendMessage("chrome", message);
        },
        onMessage: {
          addListener(listener: (...args: unknown[]) => void) {
            bridge.addMessageListener("chrome", listener);
          },
        },
        onDisconnect: {
          addListener() {},
        },
        disconnect() {
          bridge.closeAsync();
        },
      };
    },
  };

  const storage = {
    sync: {
      items: undefined as unknown,
      set(items: unknown) {
        this.items = items;
      },
      get(defaults: unknown, callback: (value: unknown) => void) {
        if (this.items) {
          callback(this.items);
        } else {
          callback(defaults);
        }
      },
    },
  };
  return {
    runtime,
    storage,
  };
}
