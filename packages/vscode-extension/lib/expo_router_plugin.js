const { useSyncExternalStore } = require("react");
const { useRouter } = require("expo-router");
const { store } = require("expo-router/src/global-state/router-store");
const { useEffect } = require("react");

function computeRouteIdentifier(pathname, params) {
  return pathname + JSON.stringify(params);
}

function useRouterPluginMainHook({ onNavigationChange }) {
  const router = useRouter();
  const routeInfo = useSyncExternalStore(
    store.subscribeToRootState,
    store.routeInfoSnapshot,
    store.routeInfoSnapshot
  );
  const pathname = routeInfo?.pathname;
  const params = routeInfo?.params;
  useEffect(() => {
    onNavigationChange({
      name: pathname,
      pathname,
      params,
      id: computeRouteIdentifier(pathname, params),
    });
  }, [pathname, params]);
  return {
    getCurrentNavigationDescriptor: () => {
      const snapshot = store.routeInfoSnapshot();
      return {
        name: snapshot.pathname,
        pathname: snapshot.pathname,
        params: snapshot.params,
        id: computeRouteIdentifier(snapshot.pathname, snapshot.params),
      };
    },
    requestNavigationChange: ({ pathname, params }) => {
      router.push(pathname, params);
    },
  };
}

global.__RNIDE_register_navigation_plugin &&
  global.__RNIDE_register_navigation_plugin("expo-router", { mainHook: useRouterPluginMainHook });
