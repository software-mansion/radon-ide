import "./View.css";
import "./LaunchConfigurationView.css";
import { useMemo, useRef, useState } from "react";
import { LaunchConfiguration, LaunchConfigurationOptions } from "../../common/LaunchConfig";
import { useModal } from "../providers/ModalProvider";
import { useProject } from "../providers/ProjectProvider";
import {
  AppRootConfig,
  useApplicationRoots,
  useAppRootConfig,
} from "../providers/ApplicationRootsProvider";
import {
  VscodeFormGroup as FormGroup,
  VscodeLabel as Label,
  VscodeTextfield,
  VscodeSingleSelect,
  VscodeOption as Option,
  VscodeFormHelper as FormHelper,
  VscodeButton as Button,
  VscodeTabPanel as TabPanel,
  VscodeTabs as Tabs,
  VscodeTabHeader as TabHeader,
  VscodeTextarea,
} from "@vscode-elements/react-elements";
import extensionPackageJSON from "../../../package.json";
import EnvEditor from "./EnvEditor";

/**
 * Vscode element components are controlled, this is a simple wrapper allowing
 * it to be used as not-controlled component with an initial value.
 */
function wrapVscodeElement<T extends { value?: string; onChange?: (e: any) => void }>(
  Component: React.ComponentType<T>
) {
  return function WrappedComponent({ initialValue, ...props }: T & { initialValue?: string }) {
    const [value, setValue] = useState(initialValue);
    return (
      <Component
        value={value}
        onChange={(e: any) => setValue((e.target as HTMLInputElement).value)}
        {...(props as T)}
      />
    );
  };
}

const TextField = wrapVscodeElement(VscodeTextfield);
const Textarea = wrapVscodeElement(VscodeTextarea);
const SingleSelect = wrapVscodeElement(VscodeSingleSelect);

function getLaunchConfigAttrs() {
  const radonIDEDebugger = extensionPackageJSON.contributes?.debuggers?.find(
    (config) => config.type === "radon-ide"
  );
  return radonIDEDebugger?.configurationAttributes?.launch;
}

function undefinedIfEmpty(value: string) {
  return value === "" ? undefined : value;
}

function undefinedIfAuto(value: string) {
  return value === "auto" ? undefined : value;
}

function formatAsJavaScriptObject(obj: Record<string, any>): string {
  if (!obj || Object.keys(obj).length === 0) return "{}";

  const entries = Object.entries(obj)
    .map(([key, value]) => {
      const keyStr = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
      const valueStr = typeof value === "string" ? `"${value}"` : JSON.stringify(value);
      return `  ${keyStr}: ${valueStr}`;
    })
    .join(",\n");

  return `{\n${entries}\n}`;
}

function serializeLaunchConfig(formData: FormData) {
  const data = Object.fromEntries(formData as any);
  const newConfig: LaunchConfigurationOptions = {
    name: data.name ?? undefined,
    appRoot: undefinedIfAuto(data.appRoot),
    metroConfigPath: undefinedIfEmpty(data.metroConfigPath),
    isExpo: data.isExpo === "true" ? true : data.isExpo === "false" ? false : undefined,
  };

  for (const platform of ["ios", "android"] as const) {
    const buildType = data[`buildType.${platform}`];
    if (buildType === "standard") {
      if (platform === "ios") {
        newConfig.ios = {
          scheme: undefinedIfAuto(data["ios.scheme"]),
          configuration: undefinedIfEmpty(data["ios.configuration"]),
        };
      } else if (platform === "android") {
        newConfig.android = {
          buildType: undefinedIfEmpty(data["android.buildType"]),
          productFlavor: undefinedIfEmpty(data["android.productFlavor"]),
        };
      }
    } else if (buildType === "custom") {
      newConfig.customBuild = {
        ...newConfig.customBuild,
        [platform]: {
          buildCommand: data[`customBuild.${platform}.buildCommand`],
          fingerprintCommand: data[`customBuild.${platform}.fingerprintCommand`],
        },
      };
    } else if (buildType === "eas") {
      newConfig.eas = {
        ...newConfig.eas,
        [platform]: {
          profile: data[`eas.${platform}.profile`],
          buildUUID: data[`eas.${platform}.buildUUID`],
        },
      };
    } else if (buildType === "eas-local") {
      newConfig.eas = {
        ...newConfig.eas,
        [platform]: {
          profile: data[`eas.${platform}.profile`],
          local: true,
        },
      };
    }
  }

  return newConfig;
}

type LaunchConfigAttrs = ReturnType<typeof getLaunchConfigAttrs>;

function LaunchConfigurationView({
  launchConfig,
  isCurrentConfig,
}: {
  launchConfig?: LaunchConfiguration;
  isCurrentConfig?: boolean;
}) {
  const { openModal, closeModal } = useModal();
  console.log("launchConfig", launchConfig);
  const applicationRoots = useApplicationRoots();

  const { project } = useProject();

  const formContainerRef = useRef<HTMLFormElement>(null);
  const [appRoot, setAppRoot] = useState<string>(
    launchConfig?.appRoot ?? applicationRoots[0]?.path ?? ""
  );
  const [env, setEnv] = useState<Record<string, string>>(launchConfig?.env ?? {});
  const appRootConfig = useAppRootConfig(appRoot);

  async function save() {
    const formData = new FormData(formContainerRef?.current ?? undefined);
    const newLaunchConfig = serializeLaunchConfig(formData);
    // Add env from state since it's not in the form
    newLaunchConfig.env = Object.keys(env).length > 0 ? env : undefined;
    await project.createOrUpdateLaunchConfiguration(newLaunchConfig, launchConfig);
    closeModal();
  }

  function DeleteConfirmationModal() {
    return (
      <div>
        <h2 className="launch-configuration-confirmation-title">
          Are you sure you want to delete the current configuration?
        </h2>
        <div className="launch-configuration-button-group">
          <Button
            className="button-secondary"
            onClick={() =>
              openModal(
                "Launch Configuration",
                <LaunchConfigurationView
                  launchConfig={launchConfig}
                  isCurrentConfig={isCurrentConfig}
                />
              )
            }>
            Cancel
          </Button>
          <Button
            onClick={() => {
              project.createOrUpdateLaunchConfiguration(undefined, launchConfig);
              closeModal();
            }}>
            Delete
          </Button>
        </div>
      </div>
    );
  }

  const availableAppRoots = applicationRoots.map((applicationRoot) => {
    return { value: applicationRoot.path, label: applicationRoot.path };
  });

  const launchConfigAttrs = useMemo(getLaunchConfigAttrs, []);

  return (
    <div className="launch-configuration-modal">
      <form ref={formContainerRef} className="launch-configuration-container">
        <FormGroup variant="settings-group">
          <Label>Name</Label>
          <FormHelper>
            The name of the launch configuration. This is used as a label for the configuration in
            the list.
          </FormHelper>
          <TextField
            name="name"
            initialValue={launchConfig?.name ?? ""}
            placeholder="Configuration Name"
          />
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>App Root</Label>
          <FormHelper>{launchConfigAttrs?.properties?.appRoot?.description}</FormHelper>
          <SingleSelect
            combobox
            creatable
            value={appRoot}
            name="appRoot"
            onChange={(e) => setAppRoot((e.target as HTMLSelectElement).value)}>
            <Option value="auto">Detect automatically</Option>
            {availableAppRoots.map((appRootOption) => (
              <Option key={appRootOption.value} value={appRootOption.value}>
                {appRootOption.label}
              </Option>
            ))}
          </SingleSelect>
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Metro Config Path</Label>
          <FormHelper>{launchConfigAttrs?.properties?.metroConfigPath?.description}</FormHelper>
          <TextField
            placeholder="Detect automatically"
            name="metroConfigPath"
            initialValue={launchConfig?.metroConfigPath ?? ""}
          />
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Use Expo CLI</Label>
          <FormHelper>{launchConfigAttrs?.properties?.isExpo?.description}</FormHelper>
          <SingleSelect
            name="isExpo"
            initialValue={
              launchConfig?.isExpo === undefined ? "Auto" : launchConfig.isExpo ? "true" : "false"
            }>
            <Option value="true">Yes</Option>
            <Option value="false">No</Option>
            <Option value="Auto">Detect automatically</Option>
          </SingleSelect>
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Environment Variables</Label>
          <FormHelper>{launchConfigAttrs?.properties?.env?.description}</FormHelper>
          <EnvEditor initialValue={env} onChange={setEnv} />
        </FormGroup>

        <Tabs panel>
          <TabHeader>iOS Build Settings</TabHeader>
          <TabPanel panel>
            <BuildConfiguration
              appRootConfig={appRootConfig}
              platform="ios"
              config={launchConfig}
              launchConfigAttrs={launchConfigAttrs}
            />
          </TabPanel>
          <TabHeader>Android Build Settings</TabHeader>
          <TabPanel panel>
            <BuildConfiguration
              appRootConfig={appRootConfig}
              platform="android"
              config={launchConfig}
              launchConfigAttrs={launchConfigAttrs}
            />
          </TabPanel>
        </Tabs>
      </form>

      <div className="launch-configuration-button-group">
        <a
          className="launch-configuration-text-button"
          role="button"
          onClick={() => {
            project.runCommand("workbench.action.debug.configure");
            closeModal();
          }}>
          Edit in launch.json
        </a>
        {launchConfig && (
          <Button
            secondary
            onClick={() => {
              openModal("", <DeleteConfirmationModal />);
            }}>
            <span className="codicon codicon-trash" />
            Delete
          </Button>
        )}
        <Button onClick={save}>Save{isCurrentConfig ? " and restart" : ""}</Button>
      </div>
    </div>
  );
}

type BuildType = "standard" | "eas" | "eas-local" | "custom";

function BuildConfiguration({
  appRootConfig,
  platform,
  config,
  launchConfigAttrs,
}: {
  appRootConfig: AppRootConfig;
  platform: "ios" | "android";
  config?: LaunchConfigurationOptions;
  launchConfigAttrs: LaunchConfigAttrs;
}) {
  let initialBuildType: BuildType = "standard";
  if (config?.eas?.[platform]) {
    initialBuildType = config.eas[platform].local ? "eas-local" : "eas";
  } else if (config?.customBuild?.[platform]) {
    initialBuildType = "custom";
  }

  const [buildType, setBuildType] = useState<BuildType>(initialBuildType);
  return (
    <>
      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">{prettyPlatformName(platform)}:</span> Build Type
        </Label>
        <SingleSelect
          value={buildType}
          name={`buildType.${platform}`}
          onChange={(e) => setBuildType((e.target as HTMLSelectElement).value as BuildType)}>
          <Option value="standard">Standard (recommended)</Option>
          <Option value="eas">EAS (Cloud-based builds)</Option>
          <Option value="eas-local">EAS Local Build</Option>
          <Option value="custom">Custom (advanced)</Option>
        </SingleSelect>
      </FormGroup>

      {buildType === "standard" && (
        <StandardBuildConfiguration
          appRootConfig={appRootConfig}
          platform={platform}
          config={config}
          launchConfigAttrs={launchConfigAttrs}
        />
      )}
      {(buildType === "eas" || buildType === "eas-local") && (
        <EasBuildConfiguration
          appRootConfig={appRootConfig}
          local={buildType === "eas-local"}
          platform={platform}
          config={config}
          launchConfigAttrs={launchConfigAttrs}
        />
      )}
      {buildType === "custom" && (
        <CustomBuildConfiguration
          platform={platform}
          config={config}
          launchConfigAttrs={launchConfigAttrs}
        />
      )}
    </>
  );
}

function StandardBuildConfiguration({
  appRootConfig,
  platform,
  config,
  launchConfigAttrs,
}: {
  appRootConfig: AppRootConfig;
  platform: "ios" | "android";
  config?: LaunchConfigurationOptions;
  launchConfigAttrs: LaunchConfigAttrs;
}) {
  if (platform === "ios") {
    const { xcodeSchemes } = appRootConfig;
    const availableXcodeSchemes = xcodeSchemes.map((xcodeScheme) => {
      return { value: xcodeScheme, label: xcodeScheme };
    });

    return (
      <>
        <FormGroup variant="settings-group">
          <Label>
            <span className="setting-item-category">iOS:</span> Scheme name
          </Label>
          <FormHelper>
            {launchConfigAttrs?.properties?.ios?.properties?.scheme?.description}
          </FormHelper>
          <SingleSelect initialValue={config?.ios?.scheme ?? "auto"} name="ios.scheme">
            <Option disabled value="auto">
              Detect automatically
            </Option>
            {availableXcodeSchemes.map((scheme) => (
              <Option key={scheme.value} value={scheme.value}>
                {scheme.label}
              </Option>
            ))}
          </SingleSelect>
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>
            <span className="setting-item-category">iOS:</span> Configuration name
          </Label>
          <FormHelper>
            {launchConfigAttrs?.properties?.ios?.properties?.configuration?.description}
          </FormHelper>
          <TextField
            initialValue={config?.ios?.configuration ?? ""}
            placeholder="Debug"
            name="ios.configuration"
          />
        </FormGroup>
      </>
    );
  } else if (platform === "android") {
    return (
      <>
        <FormGroup variant="settings-group">
          <Label>
            <span className="setting-item-category">Android:</span> Build type
          </Label>
          <FormHelper>
            {launchConfigAttrs?.properties?.android?.properties?.buildType?.description}
          </FormHelper>
          <TextField
            initialValue={config?.android?.buildType ?? ""}
            placeholder="debug"
            name="android.buildType"
          />
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>
            <span className="setting-item-category">Android:</span> Product flavor
          </Label>
          <FormHelper>
            {launchConfigAttrs?.properties?.android?.properties?.productFlavor?.description}
          </FormHelper>
          <TextField
            initialValue={config?.android?.productFlavor ?? ""}
            name="android.productFlavor"
          />
        </FormGroup>
      </>
    );
  }
}

function CustomBuildConfiguration({
  platform,
  config,
  launchConfigAttrs,
}: {
  platform: "ios" | "android";
  config?: LaunchConfigurationOptions;
  launchConfigAttrs: LaunchConfigAttrs;
}) {
  return (
    <>
      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">
            Custom {prettyPlatformName(platform)} build:
          </span>{" "}
          Build Command
        </Label>
        <FormHelper>
          {
            launchConfigAttrs?.properties?.customBuild?.properties?.[platform]?.properties
              ?.buildCommand?.description
          }
        </FormHelper>
        <TextField
          placeholder="Enter the build command"
          initialValue={config?.customBuild?.[platform]?.buildCommand ?? ""}
          name={`customBuild.${platform}.buildCommand`}
        />
      </FormGroup>

      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">
            Custom {prettyPlatformName(platform)} build:
          </span>{" "}
          Fingerprint Command
        </Label>
        <FormHelper>
          {
            launchConfigAttrs?.properties?.customBuild?.properties?.[platform]?.properties
              ?.fingerprintCommand?.description
          }
        </FormHelper>
        <TextField
          placeholder="Enter the fingerprint command"
          initialValue={config?.customBuild?.[platform]?.fingerprintCommand ?? ""}
          name={`customBuild.${platform}.fingerprintCommand`}
        />
      </FormGroup>
    </>
  );
}

type EasLaunchConfig = NonNullable<LaunchConfigurationOptions["eas"]>;
type EasPlatform = keyof EasLaunchConfig;

function prettyPlatformName(platform: EasPlatform): string {
  switch (platform) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
  }
}

function EasBuildConfiguration({
  appRootConfig,
  local,
  platform,
  config,
  launchConfigAttrs,
}: {
  appRootConfig: AppRootConfig;
  local: boolean;
  platform: EasPlatform;
  config?: LaunchConfigurationOptions;
  launchConfigAttrs: LaunchConfigAttrs;
}) {
  const { easBuildProfiles } = appRootConfig;

  const availableEasBuildProfiles = Object.entries(easBuildProfiles).map(
    ([buildProfile, buildProfileConfig]) => {
      const canRunInSimulator =
        buildProfileConfig.distribution === "internal" &&
        (platform !== "ios" || buildProfileConfig.ios?.simulator === true);
      return { value: buildProfile, label: buildProfile, disabled: !canRunInSimulator };
    }
  );
  const initialBuildProfile = config?.eas?.[platform]?.profile ?? "";
  if (
    availableEasBuildProfiles.find((profile) => profile.value === initialBuildProfile) === undefined
  ) {
    availableEasBuildProfiles.unshift({
      value: initialBuildProfile,
      label: initialBuildProfile,
      disabled: true,
    });
  }

  return (
    <>
      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">EAS {prettyPlatformName(platform)}:</span> Build
          Profile Name
        </Label>
        <FormHelper>
          {
            launchConfigAttrs?.properties?.eas?.properties?.[platform]?.properties?.profile
              ?.description
          }
        </FormHelper>
        <SingleSelect
          initialValue={initialBuildProfile}
          combobox
          creatable
          name={`eas.${platform}.profile`}>
          {availableEasBuildProfiles.map((profile) => (
            <Option key={profile.value} value={profile.value} disabled={profile.disabled}>
              {profile.label}
            </Option>
          ))}
        </SingleSelect>
      </FormGroup>

      {!local && (
        <FormGroup variant="settings-group">
          <Label>
            <span className="setting-item-category">EAS {prettyPlatformName(platform)}:</span> Build
            UUID
          </Label>
          <FormHelper>
            {
              launchConfigAttrs?.properties?.eas?.properties?.[platform]?.properties?.buildUUID
                ?.description
            }
          </FormHelper>
          <TextField
            initialValue={config?.eas?.[platform]?.buildUUID ?? ""}
            placeholder="Auto (build with matching fingerprint)"
            name={`eas.${platform}.buildUUID`}
          />
        </FormGroup>
      )}
    </>
  );
}

export default LaunchConfigurationView;
