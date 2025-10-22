// IMPORTANT: this file is injected at the beginning of React Query index file 
// so we need to use variable names that won't conflict with React Query's own variables
// hence the "RadonIDE" suffixes on everything.
import { QueryClient as QueryClientRadonIDE } from "@tanstack/query-core";
const { register: registerRadonIDE } = require("__RNIDE_lib__/plugins/expo_dev_plugins");
const { PluginMessageBridge: PluginMessageBridgeRadonIDE } = require("__RNIDE_lib__/plugins/PluginMessageBridge");

function broadcastQueryClientRadonIDE(queryClient) {
  registerRadonIDE("react-query");
  const proxy = new PluginMessageBridgeRadonIDE("react-query");

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
      proxy.sendMessage("updated", {
        queryHash,
        queryKey,
        state,
      });
    }

    if (queryEvent.type === "removed") {
      proxy.sendMessage("removed", {
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
        .forEach((query) => {
          proxy.sendMessage("updated", {
            queryHash: query.queryHash,
            queryKey: query.queryKey,
            state: query.state,
          });
        });
    });
  });
}

const origMountRadonIDE = QueryClientRadonIDE.prototype.mount;

QueryClientRadonIDE.prototype.mount = function (...args) {
  console.log("Mounting QueryClientRadonIDE");
  broadcastQueryClientRadonIDE(this);
  return origMountRadonIDE.apply(this, args);
};

// We try to register the plugin here, but if registration fails here,
// it will be registered when the first QueryClient is mounted.
registerRadonIDE("react-query");
