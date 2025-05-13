import { useEffect } from "react";
import { useRouter } from "expo-router";
import { store, useRouteInfo } from "expo-router/build/global-state/router-store.js";

function computeRouteIdentifier(pathname, params) {
  return pathname + JSON.stringify(params);
}

function extractNestedRouteList(rootNode) {
  const routeList = [];
  // TODO exclude _layout, +not-found, etc.
  const traverse = (node) => {
    if (node) {
      const { contextKey, children } = node;
      if (contextKey) {
        routeList.push(contextKey);
      }
      if (children) {
        children.forEach((child) => {
          traverse(child);
        });
      }
    }
  };
  traverse(rootNode);
  return routeList;
}

function useRouterPluginMainHook({ onNavigationChange }) {
  const router = useRouter();
  const routeInfo = useRouteInfo()

  const routeNode = store.routeNode;
  
  const pathname = routeInfo?.pathname;
  const params = routeInfo?.params;

  const filteredParams = params ?? {};
  delete filteredParams.__EXPO_ROUTER_key;

  const displayParams = new URLSearchParams(filteredParams).toString();
  const displayName = `${pathname}${displayParams ? `?${displayParams}` : ""}`;

  useEffect(() => {
    if (routeNode) {
      console.log("Route node:", routeNode);
      console.log("Root layout location:", routeNode.contextKey);
      console.log("Children:", routeNode.children);
      console.log("Flattened route list:", extractNestedRouteList(routeNode));
    }
    
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
