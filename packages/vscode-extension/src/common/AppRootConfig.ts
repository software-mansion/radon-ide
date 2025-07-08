import { EasBuildConfig } from "./EasConfig";

export type AddCustomApplicationRoot = (appRoot: string) => void;

export type ApplicationRoot = {
  path: string;
  name: string;
  displayName?: string;
};

export interface AppRootConfig {
  addCustomApplicationRoot(appRoot: string): Promise<ApplicationRoot[]>;
  getAvailableApplicationRoots(): Promise<ApplicationRoot[]>;
  getAvailableXcodeSchemes(appRootFolder?: string): Promise<string[]>;
  getAvailableEasProfiles(appRootFolder?: string): Promise<EasBuildConfig>;
}
