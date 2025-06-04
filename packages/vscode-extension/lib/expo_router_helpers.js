export function computeRouteIdentifier(pathname, params) {
  if (!params || Object.keys(params).length === 0) {
    return pathname;
  }
  const query = new URLSearchParams(params).toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function compareNavigationDescriptors(a, b) {
  if (a.pathname !== b.pathname) {
    return false;
  }
  for (const key in a.params) {
    if (a.params[key] !== b.params[key]) {
      return false;
    }
  }
  return true;
}

// Helper function to prevent duplicating dynamic segments of the route
// in the params object, as they are already part of the route path.
export function getParamsWithoutDynamicSegments(routeInfo) {
  const params = routeInfo?.params || {};
  const dynamicSegments = routeInfo?.segments.filter((segment) => segment.startsWith("[") && segment.endsWith("]")) || [];
  const dynamicSegmentKeys = dynamicSegments.map((segment) => segment.slice(1, -1));
  
  Object.keys(params).forEach((key) => {
    if (dynamicSegmentKeys.includes(key)) {
      delete params[key];
    }
  });
  delete params.__EXPO_ROUTER_key;
  
  return params;
}


// Helper function to extract the route list from Expo Router's routeNode, which is a tree-like object
// returned by the router store and the getRoutes() function, containing all indexed routes.
// For future reference: https://github.com/expo/expo/blob/main/packages/expo-router/src/getRoutes.ts

// Utility routes like _layout or +not-found should be excluded
// routeNode.route contains the "normal" route path, which is the one that should be displayed to the user
// However, we need to watch out for the first /index, which should be just /
// routeNode.dynamic is null or params[], may help with letting the user fill in the dynamic parts
// routeNode.contextKey is the full path of the route, but starts with ./ and includes parts in (brackets)
export function extractNestedRouteList(rootNode) {
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
      // We need _layout's children, so that's actually desired
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