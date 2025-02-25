import path from "path";
import fs from "fs";
import { findAppRootFolder } from "../extension";

// assuming that people may put them in the app folder
const DIRS_TO_SKIP = ["components", "(components)", "utils", "hooks"];

function computeRouteIdentifier(pathname: string, params = {}) {
  return pathname + JSON.stringify(params);
}

export type Route = {
  name: string;
  pathname: string;
  params: Record<string, any>;
  id: string;
};

function createRoute(pathname: string): Route {
  pathname = pathname.replace(/\/?\([^)]*\)/g, "");
  return {
    id: computeRouteIdentifier(pathname),
    pathname,
    name: pathname,
    params: {},
  };
}

function handleIndexRoute(basePath: string): Route {
  const pathname = basePath || "/";
  return createRoute(pathname);
}

// function handleParameterizedRoute(basePath: string, route: string): Route {
//   const pathname = `${basePath}/${route}`;
//   return createRoute(pathname);
// }

function handleRegularRoute(basePath: string, route: string): Route {
  const pathname = `${basePath}/${route}`;
  return createRoute(pathname);
}

async function getRoutes(dir: string, basePath: string = ""): Promise<Route[]> {
  let routes: Route[] = [];
  try {
    const files = await fs.promises.readdir(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.promises.stat(fullPath);

      if (stat.isDirectory()) {
        if (DIRS_TO_SKIP.includes(file)) {
          continue;
        }
        routes = routes.concat(await getRoutes(fullPath, `${basePath}/${file}`));
      } else if ((file.endsWith(".js") || file.endsWith(".tsx")) && !file.includes("_layout")) {
        const route = file.replace(/(\.js|\.tsx)$/, "");
        if (route === "index") {
          routes.push(handleIndexRoute(basePath));
        } else if (route.startsWith("[") && route.endsWith("]")) {
          // todo: think about it, perahps we can display `[param]` as a route.
          // but that option does not seem to bee much useful. I simply
          // skip those for now. Idally we'd allow typing paths similarly to
          // how we do it in the browser.
          // routes.push(handleParameterizedRoute(basePath, route));
          continue;
        } else {
          routes.push(handleRegularRoute(basePath, route));
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  return routes;
}

export async function getAppRoutes() {
  const appRoot = await findAppRootFolder();
  if (!appRoot) {
    return [];
  }
  return getRoutes(path.join(appRoot, "app"));
}
