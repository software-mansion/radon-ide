import { EasBuildConfig } from "./EasConfig";

export type ApplicationRoot = {
  path: string;
  name: string;
  displayName?: string;
};

export interface AppRootConfig {
  getAvailableApplicationRoots(): Promise<ApplicationRoot[]>;
  getAvailableXcodeSchemes(appRootFolder?: string): Promise<string[]>;
  getAvailableEasProfiles(appRootFolder?: string): Promise<EasBuildConfig>;
}
