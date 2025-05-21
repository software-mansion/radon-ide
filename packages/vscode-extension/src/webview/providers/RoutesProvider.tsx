import { createContext, useContext, useEffect, useState } from "react";
import { useProject } from "./ProjectProvider";

const RoutesContext = createContext<Route[] | null>(null);

export type Route = {
  path: string;
  filePath: string;
  children: Route[];
  dynamic: { name: string; deep: boolean; notFound?: boolean }[] | null;
  type: string;
};

export default function RoutesProvider({
  children,
  initialRoutes,
}: {
  children: React.ReactNode;
  initialRoutes?: Route[];
}) {
  const [routes, setRoutes] = useState<Route[] | null>(initialRoutes ?? null);
  const { project } = useProject();

  useEffect(() => {
    function handleAppRouteList(receivedRoutes: Route[]) {
      setRoutes(receivedRoutes);
    }
    project.addListener("navigationRouteListUpdated", handleAppRouteList);
    return () => {
      project.removeListener("navigationRouteListUpdated", handleAppRouteList);
    };
  }, [project]);

  return <RoutesContext.Provider value={routes}>{children}</RoutesContext.Provider>;
}

export function useRoutes() {
  const context = useContext(RoutesContext);
  if (!context) {
    return [];
  }
  return context;
}
export function useRoutesAsItems() {
  const routes = useRoutes();
  return routes.map((route) => ({
    id: route.path,
    name: route.path,
    dynamic: route.dynamic ? true : false,
  }));
}
