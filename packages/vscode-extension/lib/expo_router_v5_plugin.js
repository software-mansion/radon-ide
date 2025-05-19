import { useEffect } from "react";
import { useRouter } from "expo-router";
import { store, useRouteInfo } from "expo-router/build/global-state/router-store.js";
import { computeRouteIdentifier, extractNestedRouteList } from "./expo_router_helpers.js";

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
    if (!store.routeNode) {
      return;
    }
    const routeList = extractNestedRouteList(store.routeNode);
    if (global.__REACT_DEVTOOLS_GLOBAL_HOOK__?.reactDevtoolsAgent?._bridge) {
      global.__REACT_DEVTOOLS_GLOBAL_HOOK__.reactDevtoolsAgent._bridge.send("RNIDE_routeListRetrieved", {
        routes: routeList,
      });
    }
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
