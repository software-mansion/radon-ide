import "./View.css";
import "./LaunchConfigurationView.css";
import { useEffect, useMemo, useRef, useState } from "react";
import _ from "lodash";
import {
  EasConfig,
  LaunchConfiguration,
  LaunchConfigurationOptions,
  optionsForLaunchConfiguration,
} from "../../common/LaunchConfig";
import { useModal } from "../providers/ModalProvider";
import { EasBuildConfig } from "../../common/EasConfig";
import { useProject } from "../providers/ProjectProvider";
import { useApplicationRoots, useAppRootConfig } from "../providers/ApplicationRootsProvider";
import {
  VscodeScrollable as Scrollable,
  VscodeFormContainer as FormContainer,
  VscodeFormGroup as FormGroup,
  VscodeLabel as Label,
  VscodeTextfield as Textfield,
  VscodeSingleSelect as SingleSelect,
  VscodeOption as Option,
  VscodeFormHelper as FormHelper,
  VscodeButton as Button,
  VscodeRadioGroup,
  VscodeRadio,
} from "@vscode-elements/react-elements";
import extensionPackageJSON from "../../../package.json";

interface LaunchConfigurationViewProps {
  launchConfigToUpdate?: LaunchConfiguration;
}

function LaunchConfigurationView({ launchConfigToUpdate }: LaunchConfigurationViewProps) {
  const { openModal, closeModal } = useModal();
  const applicationRoots = useApplicationRoots();

  const { project, projectState } = useProject();

  const isEditingSelectedConfig = !!launchConfigToUpdate;

  const [appRoot, setAppRoot] = useState<string>(
    launchConfigToUpdate?.appRoot ?? applicationRoots[0]?.path ?? ""
  );

  function update<K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K] | "Auto"
  ) {
    if (value === "Auto") {
      value = undefined;
    }
    // newLaunchConfigOptions[key] = value;
    // setNewLaunchConfigOptions({ ...newLaunchConfigOptions });
  }

  async function save() {
    // await project.createOrUpdateLaunchConfiguration(newLaunchConfigOptions, launchConfigToUpdate);
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
                <LaunchConfigurationView launchConfigToUpdate={launchConfigToUpdate} />
              )
            }>
            Cancel
          </Button>
          <Button
            onClick={() => {
              project.createOrUpdateLaunchConfiguration(undefined, launchConfigToUpdate);
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

  const launchConfigAttrs = useMemo(() => {
    const radonIDEDebugger = extensionPackageJSON.contributes?.debuggers?.find(
      (config) => config.type === "radon-ide"
    );
    return radonIDEDebugger?.configurationAttributes?.launch;
  }, []);

  const [buildType, setBuildType] = useState<"standard" | "eas" | "custom">("standard");

  return (
    <div className="launch-configuration-modal">
      <FormContainer>
        <FormGroup variant="settings-group">
          <Label>Name</Label>
          <FormHelper>
            The name of the launch configuration. This is used as a label for the configuration in
            the list.
          </FormHelper>
          <Textfield
            defaultValue={launchConfigToUpdate?.name ?? ""}
            placeholder="Configuration Name"
          />
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>App Root</Label>
          <FormHelper>{launchConfigAttrs?.properties?.appRoot?.description}</FormHelper>
          <SingleSelect combobox creatable value="auto">
            <Option disabled value="auto">
              Detect automatically
            </Option>
            {availableAppRoots.map((appRoot) => (
              <Option key={appRoot.value} value={appRoot.value}>
                {appRoot.label}
              </Option>
            ))}
          </SingleSelect>
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Metro Config Path</Label>
          <FormHelper>{launchConfigAttrs?.properties?.metroConfigPath?.description}</FormHelper>
          <Textfield placeholder="Detect automatically" />
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Is Expo</Label>
          <FormHelper>{launchConfigAttrs?.properties?.isExpo?.description}</FormHelper>
          <SingleSelect>
            <Option value="true">Yes</Option>
            <Option value="false">No</Option>
            <Option value="Auto">Detect automatically</Option>
          </SingleSelect>
        </FormGroup>

        <FormGroup variant="settings-group">
          <Label>Build Type</Label>
          <VscodeRadioGroup variant="vertical">
            <VscodeRadio
              value="standard"
              checked={buildType === "standard"}
              onChange={() => setBuildType("standard")}>
              Standard (recommended)
            </VscodeRadio>
            <VscodeRadio
              value="eas"
              checked={buildType === "eas"}
              onChange={() => setBuildType("eas")}>
              EAS (for Expo Application Service users)
            </VscodeRadio>
            <VscodeRadio
              value="custom"
              checked={buildType === "custom"}
              onChange={() => setBuildType("custom")}>
              Custom (advanced)
            </VscodeRadio>
          </VscodeRadioGroup>
        </FormGroup>

        {buildType === "standard" && (
          <StandardBuildConfiguration appRoot={appRoot} config={launchConfigToUpdate} />
        )}
        {buildType === "eas" && (
          <EasBuildConfiguration appRoot={appRoot} config={launchConfigToUpdate} />
        )}
        {buildType === "custom" && <CustomBuildConfiguration config={launchConfigToUpdate} />}
      </FormContainer>

      <div className="launch-configuration-button-group">
        {launchConfigToUpdate && (
          <Button
            icon="trash"
            onClick={() => {
              openModal("", <DeleteConfirmationModal />);
            }}>
            <span className="codicon codicon-trash" />
            Delete
          </Button>
        )}
        <Button onClick={save}>Save{isEditingSelectedConfig ? " and restart device" : ""}</Button>
      </div>
    </div>
  );
}

function StandardBuildConfiguration({
  appRoot,
  config,
}: {
  appRoot: string;
  config?: LaunchConfiguration;
}) {
  const launchConfigAttrs = useMemo(() => {
    const radonIDEDebugger = extensionPackageJSON.contributes?.debuggers?.find(
      (config) => config.type === "radon-ide"
    );
    return radonIDEDebugger?.configurationAttributes?.launch;
  }, []);

  const { xcodeSchemes } = useAppRootConfig(appRoot);
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
        <SingleSelect value={config?.ios?.scheme ?? "Auto"}>
          <Option disabled value="Auto">
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
        <Textfield defaultValue={config?.ios?.configuration ?? "Auto"} placeholder="Debug" />
      </FormGroup>

      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">Android:</span> Build type
        </Label>
        <FormHelper>
          {launchConfigAttrs?.properties?.android?.properties?.buildType?.description}
        </FormHelper>
        <Textfield defaultValue={config?.android?.buildType ?? "Auto"} placeholder="debug" />
      </FormGroup>

      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">Android:</span> Product flavor
        </Label>
        <FormHelper>
          {launchConfigAttrs?.properties?.android?.properties?.productFlavor?.description}
        </FormHelper>
        <Textfield defaultValue={config?.android?.productFlavor ?? "Auto"} />
      </FormGroup>
    </>
  );
}

function CustomBuildConfiguration({ config }: { config?: LaunchConfiguration }) {
  return (
    <>
      <CustomPlatformBuildConfiguration platform="ios" config={config} />
      <CustomPlatformBuildConfiguration platform="android" config={config} />
    </>
  );
}

function CustomPlatformBuildConfiguration({
  platform,
  config,
}: {
  platform: "ios" | "android";
  config?: LaunchConfiguration;
}) {
  const launchConfigAttrs = useMemo(() => {
    const radonIDEDebugger = extensionPackageJSON.contributes?.debuggers?.find(
      (config) => config.type === "radon-ide"
    );
    return radonIDEDebugger?.configurationAttributes?.launch;
  }, []);
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
        <Textfield placeholder="Enter the build command" />
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
        <Textfield placeholder="Enter the fingerprint command" />
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

interface easBuildConfigurationProps {
  platform: EasPlatform;
  easBuildProfiles: EasBuildConfig;
  config?: LaunchConfiguration;
}

function EasBuildConfiguration({
  appRoot,
  config,
}: {
  appRoot: string;
  config?: LaunchConfiguration;
}) {
  const { easBuildProfiles } = useAppRootConfig(appRoot);
  return (
    <>
      <EasPlatformBuildConfiguration
        platform="ios"
        config={config}
        easBuildProfiles={easBuildProfiles}
      />
      <EasPlatformBuildConfiguration
        platform="ios"
        config={config}
        easBuildProfiles={easBuildProfiles}
      />
    </>
  );
}

function EasPlatformBuildConfiguration({
  platform,
  config,
  easBuildProfiles,
}: easBuildConfigurationProps) {
  const DISABLED = "Disabled" as const;
  const CUSTOM = "Custom" as const;
  const YES = "Yes" as const;
  const NO = "No" as const;

  const configuredProfile = config?.eas?.[platform]?.profile;
  const buildUUID = config?.eas?.[platform]?.buildUUID;
  const local = config?.eas?.[platform]?.local;

  function valueForProfile(profile: string | undefined): string {
    if (profile === undefined) {
      return DISABLED;
    }
    if (!(profile in easBuildProfiles)) {
      return CUSTOM;
    }
    return profile;
  }

  const profileValue = useMemo(() => {
    return valueForProfile(configuredProfile);
  }, [configuredProfile, easBuildProfiles]);

  const [customProfile, setCustomProfile] = useState(configuredProfile ?? "");

  const updateEasConfig = (configUpdate: Partial<EasConfig>) => {
    // const currentPlaftormConfig = eas?.[platform] ?? {};
    // const newPlatformConfig = Object.fromEntries(
    //   Object.entries({ ...currentPlaftormConfig, ...configUpdate }).filter(
    //     ([_k, v]) => v !== undefined
    //   )
    // );
    // if ("profile" in newPlatformConfig) {
    //   update("eas", { ...eas, [platform]: newPlatformConfig });
    // } else {
    //   update("eas", { ...eas, [platform]: undefined });
    // }
  };

  const updateProfile = (newProfile: string | undefined, newBuildUUID?: string) => {
    // updateEasConfig({ profile: newProfile, buildUUID: newBuildUUID });
  };

  const onProfileSelectionChange = (e: any) => {
    // const newProfile = e.target.value;
    // if (newProfile === DISABLED) {
    //   updateEasConfig({ profile: undefined, buildUUID: undefined });
    //   return;
    // }
    // if (newProfile === CUSTOM) {
    //   updateProfile(customProfile);
    // } else {
    //   updateProfile(newProfile);
    // }
  };

  const onCustomBuildProfileInputBlur = (e: any) => {
    // const newCustomProfile = e.target.value ?? "";
    // setCustomProfile(newCustomProfile);
    // updateProfile(newCustomProfile);
  };

  const onBuildUUIDInputBlur = (e: any) => {
    // const newBuildUUID = e.target.value || undefined;
    // updateEasConfig({ buildUUID: newBuildUUID });
  };

  const onBuildLocallyChange = (e: any) => {
    // const selection = e.target.value;
    // const newLocal = selection === YES ? true : undefined;
    // updateEasConfig({ local: newLocal });
  };

  const availableEasBuildProfiles = Object.entries(easBuildProfiles).map(
    ([buildProfile, config]) => {
      const canRunInSimulator =
        config.distribution === "internal" &&
        (platform !== "ios" || config.ios?.simulator === true);
      return { value: buildProfile, label: buildProfile, disabled: !canRunInSimulator };
    }
  );

  availableEasBuildProfiles.push({ value: DISABLED, label: DISABLED, disabled: false });
  availableEasBuildProfiles.push({ value: CUSTOM, label: CUSTOM, disabled: false });

  const buildLocallyOptions = [
    { value: YES, label: YES },
    { value: NO, label: NO },
  ];

  return (
    <>
      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">EAS {prettyPlatformName(platform)}:</span> Build
          Profile
        </Label>
        <SingleSelect value={profileValue} onChange={onProfileSelectionChange}>
          {availableEasBuildProfiles.map((profile) => (
            <Option key={profile.value} value={profile.value} disabled={profile.disabled}>
              {profile.label}
            </Option>
          ))}
        </SingleSelect>
      </FormGroup>

      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">EAS {prettyPlatformName(platform)}:</span> Custom
          Build Profile
        </Label>
        <Textfield
          placeholder="Enter the build profile to be used"
          defaultValue={configuredProfile ?? ""}
          onBlur={onCustomBuildProfileInputBlur}
          disabled={profileValue !== CUSTOM}
        />
      </FormGroup>

      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">EAS {prettyPlatformName(platform)}:</span> Build
          locally
        </Label>
        <SingleSelect
          value={local ? YES : NO}
          onChange={onBuildLocallyChange}
          disabled={profileValue === DISABLED}>
          {buildLocallyOptions.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </SingleSelect>
      </FormGroup>

      <FormGroup variant="settings-group">
        <Label>
          <span className="setting-item-category">EAS {prettyPlatformName(platform)}:</span> Build
          UUID
        </Label>
        <Textfield
          defaultValue={buildUUID ?? ""}
          placeholder="Auto (build with matching fingerprint)"
          onBlur={onBuildUUIDInputBlur}
          disabled={profileValue === DISABLED || local}
        />
      </FormGroup>
    </>
  );
}

export default LaunchConfigurationView;
