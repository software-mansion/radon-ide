import { register } from "../expo_dev_plugins.js";
import { PluginMessageBridge } from "../PluginMessageBridge.js";
import { stringify } from "../../third-party/flatted/esm.js";

export function patchQueryClient(clientPrototype) {
  function broadcastQueryClient(queryClient) {
    register("react-query");
    const proxy = new PluginMessageBridge("react-query");

    function sendMessage(type, payload) {
      proxy.sendMessage(type, stringify(payload));
    }

    let transaction = false;

    const tx = (cb) => {
      transaction = true;
      cb();
      transaction = false;
    };

    const queryCache = queryClient.getQueryCache();

    queryClient.getQueryCache().subscribe((queryEvent) => {
      if (transaction) {
        return;
      }

      const {
        query: { queryHash, queryKey, state },
      } = queryEvent;

      if (queryEvent.type === "updated" && queryEvent.action.type === "success") {
        sendMessage("updated", {
          queryHash,
          queryKey,
          state,
        });
      }

      if (queryEvent.type === "removed") {
        sendMessage("removed", {
          queryHash,
          queryKey,
        });
      }
    });

    proxy.addMessageListener("updated", (action) => {
      tx(() => {
        const { queryHash, queryKey, state } = action;

        const query = queryCache.get(queryHash);

        if (query) {
          query.setState(state);
          return;
        }

        queryCache.build(
          queryClient,
          {
            queryKey,
            queryHash,
          },
          state
        );
      });
    });

    proxy.addMessageListener("removed", (action) => {
      tx(() => {
        const { queryHash } = action;
        const query = queryCache.get(queryHash);

        if (query) {
          queryCache.remove(query);
        }
      });
    });

    proxy.addMessageListener("init", () => {
      tx(() => {
        queryClient
          .getQueryCache()
          .getAll()
          .forEach(({ queryHash, queryKey, state }) => {
            sendMessage("updated", {
              queryHash,
              queryKey,
              state,
            });
          });
      });
    });
  }

  try {
    const origMount = clientPrototype.mount;

    clientPrototype.mount = function (...args) {
      broadcastQueryClient(this);
      return origMount.apply(this, args);
    };

    // We try to register the plugin here, but if registration fails here,
    // it will be registered when the first QueryClient is mounted.
    register("react-query");
  } catch (e) {
    // TODO: the error should be reported to Radon and logged by the extension
  }
}
