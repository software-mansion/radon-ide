import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { store, useRouteInfo } from "expo-router/build/global-state/router-store.js";
import { 
  computeRouteIdentifier,
  extractNestedRouteList,
  sendNavigationChange
} from "./expo_router_helpers.js";

function useRouterPluginMainHook({ onNavigationChange, onRouteListChange }) {
  const router = useRouter();
  const routeInfo = useRouteInfo();

  // This always holds the second latest routeInfo to check if the navigation
  // has really changed, as sometimes the effect is called despite no actual
  // navigation change, sending duplicate events breaking the history.
  const previousRouteInfo = useRef();

  const pathname = routeInfo?.pathname;
  const params = routeInfo?.params;

  useEffect(() => {
    if (!store.routeNode) {
      return;
    }
    const routeList = extractNestedRouteList(store.routeNode);
    onRouteListChange(routeList);
  }, [store.routeNode]);

  useEffect(() => {
    sendNavigationChange(previousRouteInfo, routeInfo, onNavigationChange);
  }, [pathname, params]);

  function requestNavigationChange({ pathname, params }) {
    if (pathname === "__BACK__") {
      if (router.canGoBack()) {
        router.back();
      }
      return;
    }
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
