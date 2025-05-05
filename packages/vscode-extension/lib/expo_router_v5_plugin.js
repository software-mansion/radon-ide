import { useEffect } from "react";
import { useRouter } from "expo-router";
import { store, useRouteInfo } from "expo-router/build/global-state/router-store.js";

function computeRouteIdentifier(pathname, params) {
  return pathname + JSON.stringify(params);
}

function useRouterPluginMainHook({ onNavigationChange }) {
  const router = useRouter();
  const routeInfo = useRouteInfo()

  const pathname = routeInfo?.pathname;
  const params = routeInfo?.params;

  const filteredParams = params ?? {};
  delete filteredParams.__EXPO_ROUTER_key;

  const displayParams = new URLSearchParams(filteredParams).toString();
  const displayName = `${pathname}${displayParams ? `?${displayParams}` : ""}`;

  useEffect(() => {
    onNavigationChange({
      name: displayName,
      pathname,
      params,
      id: computeRouteIdentifier(pathname, params),
    });
  }, [pathname, params]);

  function requestNavigationChange({ pathname, params }) {
    router.navigate(pathname);
    router.setParams(params);
  }

  return {
    getCurrentNavigationDescriptor: () => {
      const snapshot = store.getRouteInfo();
      return {
        name: snapshot.pathname,
        pathname: snapshot.pathname,
        params: snapshot.params,
        id: computeRouteIdentifier(snapshot.pathname, snapshot.params),
      };
    },
    requestNavigationChange: (navigationDescriptor) => {
      if (store.navigationRef?.isReady()) {
        requestNavigationChange(navigationDescriptor);
      } else {
        const onReady = () => {
          requestNavigationChange(navigationDescriptor);
          store.navigationRef?.removeListener("state", onReady);
        };
        store.navigationRef?.addListener("state", onReady);
      }
    },
  };
}

global.__RNIDE_register_navigation_plugin &&
  global.__RNIDE_register_navigation_plugin("expo-router", { mainHook: useRouterPluginMainHook });
