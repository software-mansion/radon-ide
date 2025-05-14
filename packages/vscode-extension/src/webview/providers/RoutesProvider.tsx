import { createContext, useContext, useEffect, useState } from 'react';
import { useProject } from './ProjectProvider';

declare global {
  interface Window {
    RNIDE_lastRouteList?: Route[];
  }
}

const RoutesContext = createContext<Route[] | null>(null);

export type Route = {
  path: string;
  filePath: string;
  children: Route[];
  dynamic: {name: string, deep: Boolean, notFound?: Boolean} | null;
  type: string;
}

export default function RoutesProvider({ children }: { children: React.ReactNode }) {
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const { project } = useProject();

  useEffect(() => {
    if (window.RNIDE_lastRouteList) {
      setRoutes(window.RNIDE_lastRouteList);
    }

    function handleAppRouteList(routes: Route[]) {
      setRoutes(routes);
    }
    project.addListener("routeListRetrieved", handleAppRouteList);
    return () => {
      project.removeListener("routeListRetrieved", handleAppRouteList);
    };
  }, [project]);

  return (
    <RoutesContext.Provider value={routes}>
      {children}
    </RoutesContext.Provider>
  );
}

export function useRoutes() {
  const context = useContext(RoutesContext);
  if (!context) {
    return [];
  }
  return context;
}