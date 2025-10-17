import "./View.css";
import "./LaunchConfigurationView.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { use$ } from "@legendapp/state/react";
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
} from "@vscode-elements/react-elements";
import { useStore } from "../providers/storeProvider";
import { LaunchConfiguration, LaunchConfigurationKind } from "../../common/LaunchConfig";
import { useModal } from "../providers/ModalProvider";
import { useProject } from "../providers/ProjectProvider";
import { AppRootConfig, useAppRootConfig } from "../providers/ApplicationRootsProvider";
import extensionPackageJSON from "../../../package.json";
import useFormValidity from "../hooks/useFormValidity";
import EnvEditor from "./EnvEditor";

function TextField({
  initialValue,
  ...props
}: React.ComponentProps<typeof VscodeTextfield> & { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <VscodeTextfield
      value={value}
      onInput={(e) => setValue((e.target as HTMLInputElement).value)}
      {...props}
    />
  );
}

function SingleSelect({
  initialValue,
  required: requiredProp,
  ...props
}: React.ComponentProps<typeof VscodeSingleSelect> & { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  // The below is a workaround to an issue with vscode-elements single-select
  // component, that crashes when required is set on initial mount as it expects
  // the DOM elements to be present in order to dynamically update styles.
  // The workaround is to set the 'required' prop in effect, once all
  // the elements are mounted.
  const [required, setRequired] = useState(false);
  useEffect(() => {
    setRequired(requiredProp ?? false);
  }, [requiredProp]);

  return (
    <VscodeSingleSelect
      value={value}
      onChange={(e) => setValue((e.target as HTMLSelectElement).value)}
      required={required}
      {...props}
    />
  );
}

function getLaunchConfigAttrs() {
  const radonIDEDebugger = extensionPackageJSON.contributes?.debuggers?.find(
    (config) => config.type === "radon-ide"
  );
  return radonIDEDebugger?.configurationAttributes?.launch;
}

function undefinedIfEmpty(value: string) {
  return value === "" ? undefined : value;
}

function valueAsBoolean(value: string) {
  return value === "true" ? true : value === "false" ? false : undefined;
}

function serializeLaunchConfig(formData: FormData, defaultAppRoot: string) {
  const data = Object.fromEntries(formData as any);
  const appRoot = data.appRoot || defaultAppRoot;
  const newConfig: LaunchConfiguration = {
    kind: LaunchConfigurationKind.Custom,
    name: undefinedIfEmpty(data.name),
    appRoot,
    metroConfigPath: undefinedIfEmpty(data.metroConfigPath),
    isExpo: valueAsBoolean(data.isExpo),
    env: data.env ? JSON.parse(data.env) : {},
    usePrebuild: valueAsBoolean(data.usePrebuild),
  };

  for (const platform of ["ios", "android"] as const) {
    const buildType = data[`buildType.${platform}`];
    if (buildType === "standard") {
      if (platform === "ios") {
        newConfig.ios = {
          scheme: undefinedIfEmpty(data["ios.scheme"]),
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
          fingerprintCommand: undefinedIfEmpty(data[`customBuild.${platform}.fingerprintCommand`]),
        },
      };
    } else if (buildType === "eas") {
      newConfig.eas = {
        ...newConfig.eas,
        [platform]: {
          profile: data[`eas.${platform}.profile`],
          buildUUID: undefinedIfEmpty(data[`eas.${platform}.buildUUID`]),
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

  const store$ = useStore();
  const applicationRoots = use$(store$.applicationRoots);
  const defaultAppRoot = applicationRoots[0]?.path ?? "./";

  const { project } = useProject();

  const formContainerRef = useRef<HTMLFormElement>(null);
  const [appRoot, setAppRoot] = useState<string>(launchConfig?.appRoot ?? defaultAppRoot);
  const appRootConfig = useAppRootConfig(appRoot);

  async function save() {
    const formData = new FormData(formContainerRef?.current ?? undefined);
    const newLaunchConfig = serializeLaunchConfig(formData, defaultAppRoot);
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
            data-testid="cancel-delete-launch-configuration-button"
            onClick={() =>
              openModal(
                <LaunchConfigurationView
                  launchConfig={launchConfig}
                  isCurrentConfig={isCurrentConfig}
                />,
                { title: "Launch Configuration" }
              )
            }>
            Cancel
          </Button>
          <Button
            data-testid="confirm-delete-launch-configuration-button"
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
    <div className="launch-configuration-modal" data-testid="launch-configuration-modal">
      <form
        ref={formContainerRef}
        className="launch-configuration-container"
        onSubmit={(e) => {
          e.preventDefault();
          // if active element has data-no-submit, don't submit
          if (document.activeElement?.hasAttribute("data-no-submit")) {
            return;
          }
          if (formContainerRef.current?.checkValidity()) {
            save();
          }
        }}>
        <FormGroup variant="settings-group">
          <Label>Name</Label>
          <FormHelper>
            The name of the launch configuration. This is used as a label for the configuration in
            the list.
          </FormHelper>
          <TextField
            name="name"
            data-testid="launch-configuration-name-input"
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
            <Option value="">Detect automatically</Option>
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
            data-testid="launch-configuration-metro-config-path-input"
            name="metroConfigPath"
            initialValue={launchConfig?.metroConfigPath ?? ""}
          />
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Use Expo CLI</Label>
          <FormHelper>{launchConfigAttrs?.properties?.isExpo?.description}</FormHelper>
          <SingleSelect
            data-testid="launch-configuration-use-expo-select"
            name="isExpo"
            initialValue={
              launchConfig?.isExpo === undefined ? "" : launchConfig.isExpo ? "true" : "false"
            }>
            <Option
              value=""
              data-testid="launch-configuration-use-expo-select-detect-automatically">
              Detect automatically
            </Option>
            <Option value="true" data-testid="launch-configuration-use-expo-select-yes">
              Yes
            </Option>
            <Option value="false" data-testid="launch-configuration-use-expo-select-no">
              No
            </Option>
          </SingleSelect>
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Use Expo Prebuild</Label>
          <FormHelper>{launchConfigAttrs?.properties?.usePrebuild?.description}</FormHelper>
          <SingleSelect
            data-testid="launch-configuration-use-prebuild-select"
            name="usePrebuild"
            initialValue={launchConfig?.usePrebuild ? "true" : "false"}>
            <Option value="true" data-testid="launch-configuration-use-prebuild-yes">
              Yes
            </Option>
            <Option value="false" data-testid="launch-configuration-use-prebuild-no">
              No
            </Option>
          </SingleSelect>
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Environment Variables</Label>
          <FormHelper>{launchConfigAttrs?.properties?.env?.description}</FormHelper>
          <EnvEditor initialValue={launchConfig?.env ?? {}} />
        </FormGroup>

        <Tabs panel>
          <TabHeader data-testid="launch-configuration-ios-build-settings-tab">
            iOS Build Settings
          </TabHeader>
          <TabPanel panel>
            <BuildConfiguration
              appRootConfig={appRootConfig}
              platform="ios"
              config={launchConfig}
              launchConfigAttrs={launchConfigAttrs}
            />
          </TabPanel>
          <TabHeader data-testid="launch-configuration-android-build-settings-tab">
            Android Build Settings
          </TabHeader>
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
            project.openLaunchConfigurationFile();
            closeModal();
          }}>
          Edit in launch.json
        </a>
        {launchConfig && (
          <Button
            secondary
            data-testid="launch-configuration-delete-button"
            onClick={() => {
              openModal(<DeleteConfirmationModal />);
            }}>
            <span className="codicon codicon-trash" />
            Delete
          </Button>
        )}
        <Button
          onClick={save}
          disabled={!useFormValidity(formContainerRef)}
          type="submit"
          data-testid="launch-configuration-modal-save-button">
          Save{isCurrentConfig ? " and restart" : ""}
        </Button>
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
  config?: LaunchConfiguration;
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
  config?: LaunchConfiguration;
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
          <SingleSelect initialValue={config?.ios?.scheme ?? ""} name="ios.scheme">
            <Option disabled value="">
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
            data-testid="launch-configuration-ios-configuration-input"
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
            data-testid="launch-configuration-android-configuration-input"
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
  config?: LaunchConfiguration;
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
          required
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

type EasLaunchConfig = NonNullable<LaunchConfiguration["eas"]>;
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
  config?: LaunchConfiguration;
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
          required
          position="above"
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
