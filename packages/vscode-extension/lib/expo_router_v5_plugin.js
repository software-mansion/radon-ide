import { useEffect } from "react";
import { useRouter } from "expo-router";
import { store, useRouteInfo } from "expo-router/build/global-state/router-store.js";

function computeRouteIdentifier(pathname, params) {
  return pathname + JSON.stringify(params);
}

// Utility routes like _layout or +not-found should be excluded
// routeNode.route contains the "normal" route path, which is the one that should be displayed to the user
// However, we need to watch out for the first /index, which should be just /
// routeNode.dynamic is null or params[], may help with letting the user fill in the dynamic parts
// routeNode.contextKey is the full path of the route, but starts with ./ and includes parts in (brackets)
// the URL works as is (excluding index), but those parts shouldn't be displayed in the list seen by the user
// e.g. ./(auth)/login -> /login
function extractNestedRouteList(rootNode) {
  const routeList = [];

  const traverse = (node) => {
    let indexFound = false;
    const handleIndexFound = (route) => {
      indexFound = true;
      return "/" + route.replace("index", "");
    }

    if (node) {
      const { contextKey, children, route, dynamic, type } = node;
      const fileName = route.split("/").pop();

      // Won't match _layout, because for it the fileName is empty
      // We need _layout's children, so that's necessary
      if (fileName.startsWith("_") || fileName.startsWith("+")) {
        return;
      }
      if (type === "route") {
        routeList.push({
          path: fileName === "index" && !indexFound ? handleIndexFound(route) : "/" + route,
          filePath: contextKey,
          children: children,
          dynamic: dynamic,
          type: type
        });
      }
      if (children) {
        children.forEach((child) => {
          traverse(child);
        });
      }
    }
  };
  traverse(rootNode);

  return routeList.sort((a, b) => {
    const aPath = a.path.split("/");
    const bPath = b.path.split("/");
    if (aPath.length === bPath.length) {
      return a.path.localeCompare(b.path);
    }
    return aPath.length - bPath.length;
  });
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
      const routeList = extractNestedRouteList(routeNode);
      console.log("Route list:", routeList);
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
