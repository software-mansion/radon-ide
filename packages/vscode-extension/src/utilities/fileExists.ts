import fs from "fs";
import path from "path";

export function fileExists(filePath: string, ...additionalPaths: string[]) {
  return fs.existsSync(path.join(filePath, ...additionalPaths));
}
