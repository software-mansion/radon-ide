import { useSyncExternalStore, useEffect } from "react";
import { useRouter } from "expo-router";
import { store } from "expo-router/src/global-state/router-store";
import { computeRouteIdentifier, extractNestedRouteList } from "./expo_router_helpers.js";

function computeRouteIdentifier(pathname, params) {
  return pathname + JSON.stringify(params);
}

function useRouterPluginMainHook({ onNavigationChange, onRouteListChange }) {
  const router = useRouter();
  const routeInfo = useSyncExternalStore(
    store.subscribeToRootState,
    store.routeInfoSnapshot,
    store.routeInfoSnapshot
  );

  const pathname = routeInfo?.pathname;
  const params = routeInfo?.params;
  
  const displayParams = new URLSearchParams(params).toString();
  const displayName = `${pathname}${displayParams ? `?${displayParams}` : ''}`;

  useEffect(() => {
    if (!store.routeNode) {
      return;
    }
    const routeList = extractNestedRouteList(store.routeNode);
    onRouteListChange(routeList);
  }, [store.routeNode]);

  useEffect(() => {
    onNavigationChange({
      name: displayName,
      pathname,
      params,
      id: computeRouteIdentifier(pathname, params),
    });
  }, [pathname, params]);

  function requestNavigationChange({ pathname, params }) {
    if (pathname === "__BACK__") {
      if (router.canGoBack()) {
        router.back();
      }
      return;
    }
    router.push(pathname);
    router.setParams(params);
  }

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
