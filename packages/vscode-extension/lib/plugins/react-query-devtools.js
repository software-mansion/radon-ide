
const { useEffect } = require("react");
const { RNIDEProxyClient } = require("./utils");

let proxyClient = null;

export const isProxyClientReady = () => proxyClient !== null;

export const clearProxyClient = () => proxyClient = null;

export const createRNIDEProxyClientAsync = async () => {
  if (proxyClient !== null) {
    return proxyClient;
  }
  
  proxyClient = new RNIDEProxyClient('RNIDE-react-query-devtools');

  return proxyClient;
};

async function injectReactQueryDevtools(queryClient) {
  const client = await createRNIDEProxyClientAsync();
  const queryCache = queryClient.getQueryCache();

  let unsubscribe;

  function getQueries() {
    return queryCache.getAll();
  }

  function getQueryByHash(queryHash)  {
    return getQueries().find((query) => query.queryHash === queryHash);
  }

  function getSerializedQueries() {
    const queries = getQueries().map((query) => serializeQuery(query));

    const serializedQueries = {
      queries: JSON.stringify(queries),
    };

    return serializedQueries;
  }

  client?.addMessageListener('queryRefetch', ({ queryHash }) => {
    getQueryByHash(queryHash)?.fetch();
  })

  client?.addMessageListener('queryRemove', ({ queryHash }) => {
    const query = getQueryByHash(queryHash);
    if (query) {
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
    }
  })

  // send initial queries
  client?.sendMessage('queries', getSerializedQueries());

  /**
   * handles QueryCacheNotifyEvent
   * @param event - QueryCacheNotifyEvent, but RQ doesn't have it exported
   */
  const handleCacheEvent = (event) => {
    const { query } = event;
    console.log("EVENT", query, client);
    client?.sendMessage('queryCacheEvent', {
      cacheEvent: JSON.stringify({ ...event, query: serializeQuery(query) }),
    });
  };

  unsubscribe = queryCache.subscribe(handleCacheEvent);
}

function serializeQuery(query) {
  return {
    ...query,
    _ext_isActive: query.isActive(),
    _ext_isStale: query.isStale(),
    _ext_observersCount: query.getObserversCount(),
  };
}

global.__RNIDE_REACT_QUERY_CLIENT_INIT__ = injectReactQueryDevtools;


// TODO: to late init 
createRNIDEProxyClientAsync(); 

export const useReactQueryDevTools = (devtoolsAgent) => {
  useEffect(() => {
    console.log("SET DEVTOOLS AGENT")
    proxyClient?.setDevtoolsAgent(devtoolsAgent);

    return () => {
      proxyClient?.clearDevToolsAgent();
    };
  }, [devtoolsAgent]);
};