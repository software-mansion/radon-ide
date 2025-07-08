import "./View.css";
import "./LaunchConfigurationView.css";
import { useEffect, useMemo, useRef, useState } from "react";
import _ from "lodash";
import Label from "../components/shared/Label";
import { ApplicationRoot } from "../../common/AppRootConfig";
import {
  EasConfig,
  LaunchConfiguration,
  LaunchConfigurationOptions,
  optionsForLaunchConfiguration,
} from "../../common/LaunchConfig";
import Select from "../components/shared/Select";
import { useModal } from "../providers/ModalProvider";
import Button from "../components/shared/Button";
import { Input } from "../components/shared/Input";
import { EasBuildConfig } from "../../common/EasConfig";
import { useProject } from "../providers/ProjectProvider";
import { useApplicationRoots, useAppRootConfig } from "../providers/ApplicationRootsProvider";

interface LaunchConfigurationViewProps {
  launchConfigToUpdate?: LaunchConfiguration;
}

function LaunchConfigurationView({ launchConfigToUpdate }: LaunchConfigurationViewProps) {
  const { openModal, closeModal } = useModal();
  const applicationRoots = useApplicationRoots();

  const { project, projectState } = useProject();

  const isEditingSelectedConfig = useMemo(
    () => _.isEqual(projectState.selectedLaunchConfiguration, launchConfigToUpdate),
    [projectState.selectedLaunchConfiguration, launchConfigToUpdate]
  );

  const [newLaunchConfigOptions, setNewLaunchConfigOptions] = useState<LaunchConfigurationOptions>(
    launchConfigToUpdate ? optionsForLaunchConfiguration(launchConfigToUpdate) : {}
  );
  const { android, appRoot, ios, eas, isExpo, metroConfigPath } = newLaunchConfigOptions;
  const { xcodeSchemes, easBuildProfiles } = useAppRootConfig(appRoot);

  function update<K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K] | "Auto"
  ) {
    if (value === "Auto") {
      value = undefined;
    }
    newLaunchConfigOptions[key] = value;
    setNewLaunchConfigOptions({ ...newLaunchConfigOptions });
  }

  async function save() {
    await project.createOrUpdateLaunchConfiguration(newLaunchConfigOptions, launchConfigToUpdate);
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
            onClick={() =>
              openModal(
                "Launch Configuration",
                <LaunchConfigurationView launchConfigToUpdate={launchConfigToUpdate} />
              )
            }>
            Cancel
          </Button>
          <Button
            className="launch-configuration-delete"
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

  return (
    <div className="launch-configuration-modal">
      <div className="launch-configuration-container">
        <Label>Name</Label>
        <NameConfiguration name={newLaunchConfigOptions.name} update={update} />
        <div className="launch-configuration-section-margin" />

        <Label>iOS</Label>
        <IosConfiguration
          scheme={ios?.scheme}
          configuration={ios?.configuration}
          update={update}
          xcodeSchemes={xcodeSchemes}
        />
        <div className="launch-configuration-section-margin" />

        <Label>Android</Label>
        <AndroidConfiguration
          buildType={android?.buildType}
          productFlavor={android?.productFlavor}
          update={update}
        />

        <div className="launch-configuration-section-margin" />

        <Label>App Root</Label>
        <AppRootConfiguration
          appRoot={appRoot}
          update={update}
          applicationRoots={applicationRoots}
        />
        <div className="launch-configuration-section-margin" />

        <Label>metro Config Path</Label>
        <MetroConfigPathConfiguration metroConfigPath={metroConfigPath} update={update} />

        <div className="launch-configuration-section-margin" />

        <Label>is Expo</Label>
        <IsExpoConfiguration isExpo={isExpo} update={update} />

        <div className="launch-configuration-section-margin" />

        <Label>EAS Build</Label>
        <EasBuildConfiguration
          platform="ios"
          eas={eas}
          update={update}
          easBuildProfiles={easBuildProfiles}
        />
        <EasBuildConfiguration
          platform="android"
          eas={eas}
          update={update}
          easBuildProfiles={easBuildProfiles}
        />
      </div>
      <div className="launch-configuration-section-margin" />

      <div className="launch-configuration-button-group">
        <Button onClick={save}>Save{isEditingSelectedConfig ? " and restart device" : ""}</Button>
        {launchConfigToUpdate && (
          <Button
            className="launch-configuration-delete"
            onClick={() => {
              openModal("Delete Launch Configuration", <DeleteConfirmationModal />);
            }}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

type LaunchConfigUpdater = <K extends keyof LaunchConfigurationOptions>(
  key: K,
  value: LaunchConfigurationOptions[K] | "Auto"
) => void;

interface NameConfigurationProps {
  name?: string;
  update: LaunchConfigUpdater;
}

function NameConfiguration({ name, update }: NameConfigurationProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  const onNameBlur = () => {
    let newName = nameInputRef.current?.value;
    if (newName === "Auto" || newName === "") {
      newName = undefined;
    }
    update("name", newName);
  };

  return (
    <div className="launch-configuration-group">
      <div className="setting-description">Configuration Name:</div>
      <Input
        ref={nameInputRef}
        className="input-configuration"
        type="string"
        defaultValue={name ?? ""}
        placeholder="Configuration Name"
        onBlur={onNameBlur}
      />
    </div>
  );
}

interface iosConfigurationProps {
  scheme?: string;
  configuration?: string;
  update: LaunchConfigUpdater;
  xcodeSchemes: string[];
}

function IosConfiguration({ scheme, configuration, update, xcodeSchemes }: iosConfigurationProps) {
  const configurationInputRef = useRef<HTMLInputElement>(null);

  const onSchemeChange = (newScheme: string | undefined) => {
    if (newScheme === "Auto") {
      newScheme = undefined;
    }
    update("ios", { scheme: newScheme, configuration });
  };

  const onConfigurationBlur = () => {
    let newConfiguration = configurationInputRef.current?.value;
    if (newConfiguration === "Auto" || newConfiguration !== "") {
      newConfiguration = undefined;
    }
    update("ios", { scheme, configuration: newConfiguration });
  };

  const availableXcodeSchemes = xcodeSchemes.map((xcodeScheme) => {
    return { value: xcodeScheme, label: xcodeScheme };
  });

  availableXcodeSchemes.push({ value: "Auto", label: "Auto" });

  return (
    <div className="launch-configuration-group">
      <div className="setting-description">Scheme:</div>
      <Select
        value={scheme ?? "Auto"}
        onChange={onSchemeChange}
        items={availableXcodeSchemes}
        className="scheme"
      />
      <div className="setting-description">Configuration:</div>
      <Input
        ref={configurationInputRef}
        className="input-configuration"
        type="string"
        defaultValue={configuration ?? "Auto"}
        onBlur={onConfigurationBlur}
      />
    </div>
  );
}

interface androidConfigurationProps {
  buildType?: string;
  productFlavor?: string;
  update: LaunchConfigUpdater;
}

function AndroidConfiguration({ buildType, productFlavor, update }: androidConfigurationProps) {
  const buildTypeInputRef = useRef<HTMLInputElement>(null);
  const productFlavorInputRef = useRef<HTMLInputElement>(null);

  const onBuildTypeBlur = () => {
    let newBuildType = buildTypeInputRef.current?.value;
    if (newBuildType === "Auto" || newBuildType !== "") {
      newBuildType = undefined;
    }
    update("android", { buildType: newBuildType, productFlavor });
  };

  const onProductFlavorBlur = () => {
    let newProductFlavor = productFlavorInputRef.current?.value;
    if (newProductFlavor === "Auto" || newProductFlavor !== "") {
      newProductFlavor = undefined;
    }
    update("android", { buildType, productFlavor: newProductFlavor });
  };

  return (
    <div className="launch-configuration-group">
      <div className="setting-description">Build Type:</div>
      <Input
        ref={buildTypeInputRef}
        type="string"
        defaultValue={buildType ?? "Auto"}
        onBlur={onBuildTypeBlur}
      />
      <div className="setting-description">Product Flavor:</div>
      <Input
        ref={productFlavorInputRef}
        type="string"
        defaultValue={productFlavor ?? "Auto"}
        onBlur={onProductFlavorBlur}
      />
    </div>
  );
}

interface appRootConfigurationProps {
  appRoot?: string;
  update: LaunchConfigUpdater;
  applicationRoots: ApplicationRoot[];
}

function AppRootConfiguration({ appRoot, update, applicationRoots }: appRootConfigurationProps) {
  const customAppRootInputRef = useRef<HTMLInputElement>(null);

  function getInitialSelectedValue(): string {
    if (appRoot === undefined) {
      return "Auto";
    }
    if (applicationRoots.some((ar) => ar.path === appRoot)) {
      return appRoot;
    }
    return "Custom";
  }

  const [selectedValue, setSelectedValue] = useState(getInitialSelectedValue());

  const onAppRootChange = (newAppRoot: string | undefined) => {
    setSelectedValue(newAppRoot || "Auto");
    if (newAppRoot === "Custom") {
      // in this case, we apply the setting in the input blur handler
      return;
    }
    if (customAppRootInputRef.current) {
      customAppRootInputRef.current.value = "";
    }
    if (newAppRoot === undefined || newAppRoot === "Auto") {
      newAppRoot = applicationRoots[0]?.path ?? "Auto";
    }
    update("appRoot", newAppRoot);
  };

  function onCustomAppRootInputBlur() {
    const newAppRoot = customAppRootInputRef.current?.value;
    if (newAppRoot) {
      update("appRoot", newAppRoot);
    }
  }

  const availableAppRoots = applicationRoots.map((applicationRoot) => {
    return { value: applicationRoot.path, label: applicationRoot.path };
  });

  if (availableAppRoots.length > 0) {
    availableAppRoots.push({ value: "Auto", label: `${applicationRoots[0].path} (Auto)` });
  }
  availableAppRoots.push({ value: "Custom", label: "Custom" });

  return (
    <div className="launch-configuration-group">
      <div className="setting-description">AppRoot:</div>
      <Select
        value={selectedValue}
        onChange={onAppRootChange}
        items={availableAppRoots}
        className="scheme"
      />
      <div className="setting-description">Add Custom Application Root:</div>
      <input
        ref={customAppRootInputRef}
        className="input-configuration"
        type="string"
        placeholder={"Custom/Application/Root/Path"}
        disabled={selectedValue !== "Custom"}
        onBlur={onCustomAppRootInputBlur}
      />
    </div>
  );
}

interface metroPathConfigurationProps {
  metroConfigPath?: string;
  update: LaunchConfigUpdater;
}

function MetroConfigPathConfiguration({ metroConfigPath, update }: metroPathConfigurationProps) {
  const metroPathInputRef = useRef<HTMLInputElement>(null);

  const onMetroPathBlur = () => {
    let newMetroPath = metroPathInputRef.current?.value;
    if (newMetroPath !== "") {
      newMetroPath = "Auto";
    }
    update("metroConfigPath", newMetroPath);
  };

  return (
    <div className="launch-configuration-group">
      <div className="setting-description">Metro Config Path:</div>
      <Input
        ref={metroPathInputRef}
        className="input-configuration"
        type="string"
        defaultValue={metroConfigPath ?? "Auto"}
        onBlur={onMetroPathBlur}
      />
    </div>
  );
}

interface isExpoConfigurationProps {
  isExpo?: boolean;
  update: LaunchConfigUpdater;
}

function IsExpoConfiguration({ isExpo, update }: isExpoConfigurationProps) {
  const options = [
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
    { value: "Auto", label: "Auto" },
  ];

  const onIsExpoChange = (newIsExpo: string) => {
    let updatedIsExpo: "Auto" | boolean = "Auto";
    if (newIsExpo === "true") {
      updatedIsExpo = true;
    } else if (newIsExpo === "false") {
      updatedIsExpo = false;
    }
    update("isExpo", updatedIsExpo);
  };

  return (
    <div className="launch-configuration-group">
      <div className="setting-description">Is Expo:</div>
      <Select
        value={isExpo?.toString() ?? "Auto"}
        onChange={onIsExpoChange}
        items={options}
        className="scheme"
      />
    </div>
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
  eas?: EasLaunchConfig;
  platform: EasPlatform;
  update: LaunchConfigUpdater;
  easBuildProfiles: EasBuildConfig;
}

function EasBuildConfiguration({
  eas,
  platform,
  update,
  easBuildProfiles,
}: easBuildConfigurationProps) {
  const DISABLED = "Disabled" as const;
  const CUSTOM = "Custom" as const;
  const YES = "Yes" as const;
  const NO = "No" as const;

  const configuredProfile = eas?.[platform]?.profile;
  const buildUUID = eas?.[platform]?.buildUUID;
  const local = eas?.[platform]?.local;

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

  useEffect(() => {
    if (profileValue !== CUSTOM && customBuildProfileInputRef.current) {
      customBuildProfileInputRef.current.value = "";
    }
  }, [profileValue]);

  const buildUUIDInputRef = useRef<HTMLInputElement>(null);
  const customBuildProfileInputRef = useRef<HTMLInputElement>(null);

  const updateEasConfig = (configUpdate: Partial<EasConfig>) => {
    const currentPlaftormConfig = eas?.[platform] ?? {};
    const newPlatformConfig = Object.fromEntries(
      Object.entries({ ...currentPlaftormConfig, ...configUpdate }).filter(
        ([_k, v]) => v !== undefined
      )
    );
    if ("profile" in newPlatformConfig) {
      update("eas", { ...eas, [platform]: newPlatformConfig });
    } else {
      update("eas", { ...eas, [platform]: undefined });
    }
  };

  const updateProfile = (newProfile: string | undefined) => {
    const newBuildUUID = buildUUIDInputRef.current?.value || undefined;
    updateEasConfig({ profile: newProfile, buildUUID: newBuildUUID });
  };

  const onProfileSelectionChange = (newProfile: string) => {
    if (newProfile === DISABLED) {
      updateEasConfig({ profile: undefined, buildUUID: undefined });
      return;
    }

    if (newProfile === CUSTOM) {
      newProfile = customBuildProfileInputRef.current?.value ?? configuredProfile ?? "";
    }
    updateProfile(newProfile);
  };

  const onCustomBuildProfileInputBlur = () => {
    const newCustomProfile = customBuildProfileInputRef.current?.value ?? "";
    updateProfile(newCustomProfile);
  };

  const onBuildUUIDInputBlur = () => {
    const newBuildUUID = buildUUIDInputRef.current?.value || undefined;
    updateEasConfig({ buildUUID: newBuildUUID });
  };

  const onBuildLocallyChange = (selection: string) => {
    const newLocal = selection === YES ? true : undefined;
    updateEasConfig({ local: newLocal });
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
    <div className="launch-configuration-group">
      <div className="setting-description">{prettyPlatformName(platform)} Build Profile:</div>
      <Select
        value={profileValue}
        onChange={onProfileSelectionChange}
        items={availableEasBuildProfiles}
        className="scheme"
      />
      <div className="setting-description">
        {prettyPlatformName(platform)} Custom Build Profile:
      </div>
      <Input
        ref={customBuildProfileInputRef}
        className="input-configuration"
        type="string"
        placeholder="Enter the build profile to be used"
        defaultValue={configuredProfile ?? ""}
        onBlur={onCustomBuildProfileInputBlur}
        disabled={profileValue !== CUSTOM}
      />
      <div className="setting-description">Build locally:</div>
      <Select
        value={local ? YES : NO}
        onChange={onBuildLocallyChange}
        items={buildLocallyOptions}
        className="scheme"
        disabled={profileValue === DISABLED}
      />
      <div className="setting-description">{prettyPlatformName(platform)} Build UUID:</div>
      <Input
        ref={buildUUIDInputRef}
        className="input-configuration"
        type="string"
        defaultValue={buildUUID ?? ""}
        placeholder="Auto (build with matching fingerprint)"
        onBlur={onBuildUUIDInputBlur}
        disabled={profileValue === DISABLED || local}
      />
    </div>
  );
}

export default LaunchConfigurationView;
