const { RNIDEAppExtensionProxy } = require("./utils");

export function broadcastQueryClient(scope, queryClient) {
  const proxy = new RNIDEAppExtensionProxy(scope);

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

    if (queryEvent.type === 'updated' && queryEvent.action.type === 'success') {
      proxy.sendMessage("updated", {
        queryHash,
        queryKey,
        state,
      });
    }
    
    if (queryEvent.type === 'removed') {
      proxy.sendMessage('removed', {
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
}
