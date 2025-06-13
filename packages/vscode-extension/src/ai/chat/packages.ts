import * as vscode from "vscode";
import { RelativePattern } from "vscode";
import { Logger } from "../../Logger";
import { findAppRootFolder } from "../../utilities/extensionContext";
import { calculateMD5 } from "../../utilities/common";
import { CHAT_LOG } from ".";

interface Package {
  path: string;
  name: string;
  version: string;
}

const appRootFolder = findAppRootFolder() ?? "";
const packages: Package[] = [];
let packageJsonHashes: string[] = [];

async function getPackageJsonHashes(): Promise<string[]> {
  const packageJsonFiles = await vscode.workspace.findFiles(
    new RelativePattern(appRootFolder, "package.json"),
    null
  );

  if (!packageJsonFiles.length) {
    Logger.error("No package.json found in the workspace");
    return [];
  }

  const hashes = packageJsonFiles.map((packageJson) =>
    calculateMD5(packageJson.fsPath).then((hash) => hash.digest("hex"))
  );

  const resolvedHashes = await Promise.all(hashes);

  return resolvedHashes;
}

export function compareUnorderedArrays(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, i) => value === sortedB[i]);
}

async function getReactNativePackages(): Promise<Package[]> {
  // if we have already scanned the packages, we can skip the scan if package.json has not changed
  if (packageJsonHashes.length !== 0) {
    // check if hash is the same
    const newPackageJsonHashes = await getPackageJsonHashes();
    if (compareUnorderedArrays(newPackageJsonHashes, packageJsonHashes)) {
      return packages;
    }

    Logger.info(CHAT_LOG, "Found changes in package.json, rescanning packages");
    // update hash
    packageJsonHashes = newPackageJsonHashes;
    // empty packages array
    packages.length = 0;
  } else {
    // generate hash for the first time
    packageJsonHashes = await getPackageJsonHashes();
  }

  Logger.info(CHAT_LOG, "Scanning node_modules for React Native packages");
  // we scan node_modules here because different package managers use different lock files
  // and bun uses binary format - bun.lockb - which is not the easiest to parse
  const packageFiles = await vscode.workspace.findFiles(
    "**/node_modules/**/*{expo,react-native,react-navigation}*/package.json",
    "**/node_modules/**/*{export,exponent}*"
  );

  for await (const pkg of packageFiles) {
    try {
      const packageJsonDoc = await vscode.workspace.openTextDocument(pkg);
      const { name, version } = JSON.parse(packageJsonDoc.getText());
      const relativePath = vscode.workspace.asRelativePath(pkg.path);

      // last 3 segments will always be: node_modules/<package-name>/package.json
      // we are only interested in the part before these 3 segments
      const trimmedPath = relativePath.split("/").slice(0, -3).join("/");

      if (trimmedPath.includes("node_modules")) {
        // ignore packages that are nested inside other node_modules packages
        continue;
      }

      packages.push({ path: trimmedPath, name, version });
    } catch (err) {
      Logger.error(`Error reading package.json: ${err}`);
      return [];
    }
  }

  packages.sort((a, b) => a.path.localeCompare(b.path));
  return packages;
}

export async function getReactNativePackagesPrompt(): Promise<string> {
  let prompt = "User has the following packages installed in the project:\n";
  const rnPackages = await getReactNativePackages();

  if (rnPackages.length === 0) {
    return "";
  }
  let prevPath = "";
  rnPackages.forEach((pkg) => {
    if (pkg.path !== prevPath) {
      prompt += `\n"${pkg.path}":\n`;
      prevPath = pkg.path;
    }

    prompt += `- ${pkg.name}@${pkg.version}\n`;
  });

  return prompt;
}
