import "./View.css";
import "./LaunchConfigurationView.css";
import { useRef, useState } from "react";
import Label from "../components/shared/Label";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import {
  AddCustomApplicationRoot,
  EasConfig,
  LaunchConfigUpdater,
  LaunchConfigurationOptions,
} from "../../common/LaunchConfig";
import Select from "../components/shared/Select";
import { useModal } from "../providers/ModalProvider";
import Button from "../components/shared/Button";
import { Input } from "../components/shared/Input";
import { EasBuildConfig } from "../../common/EasConfig";

function LaunchConfigurationView() {
  const {
    android,
    appRoot,
    ios,
    eas,
    isExpo,
    metroConfigPath,
    update,
    xcodeSchemes,
    easBuildProfiles,
    applicationRoots,
    addCustomApplicationRoot,
  } = useLaunchConfig();

  return (
    <>
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
        addCustomApplicationRoot={addCustomApplicationRoot}
      />
      <div className="launch-configuration-section-margin" />

      <Label>metro Config Path</Label>
      <MetroConfigPathConfiguration metroConfigPath={metroConfigPath} update={update} />

      <div className="launch-configuration-section-margin" />

      <Label>is Expo</Label>
      <IsExpoConfiguration isExpo={isExpo} update={update} />

      <div className="launch-configuration-section-margin" />

      {!!easBuildProfiles && (
        <>
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

          <div className="launch-configuration-section-margin" />
        </>
      )}
    </>
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
    <div className="launch-configuration-container">
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
    <div className="launch-configuration-container">
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
  applicationRoots: string[];
  addCustomApplicationRoot: AddCustomApplicationRoot;
}

function AppRootConfiguration({
  appRoot,
  update,
  applicationRoots,
  addCustomApplicationRoot,
}: appRootConfigurationProps) {
  const customAppRootInputRef = useRef<HTMLInputElement>(null);

  const { openModal, closeModal } = useModal();

  const [customAppRootButtonDisabled, setCustomAppRootButtonDisabled] = useState(true);

  const onConfirmationCancel = () => {
    openModal("Launch Configuration", <LaunchConfigurationView />);
  };

  const AppRootChangeConfirmationView = ({ newAppRoot }: { newAppRoot: string }) => {
    return (
      <div className="app-root-change-wrapper">
        <h2 className="app-root-change-title">
          Are you sure you want to change the application root?
        </h2>
        <p className="app-root-change-subtitle">
          The new application root will be: <b>{newAppRoot}</b> and this action will reboot the
          device.
        </p>
        <div className="app-root-change-button-group">
          <Button
            type="secondary"
            className="app-root-change-button"
            onClick={onConfirmationCancel}>
            Cancel
          </Button>
          <Button
            className="app-root-change-button"
            type="ternary"
            onClick={async () => {
              update("appRoot", newAppRoot);
              closeModal();
            }}>
            Confirm
          </Button>
        </div>
      </div>
    );
  };

  const CustomAppRootConfirmationView = ({ newAppRoot }: { newAppRoot: string }) => {
    return (
      <div className="app-root-change-wrapper">
        <h2 className="app-root-change-title">
          Are you sure you want to add custom application root?
        </h2>
        <p className="app-root-change-subtitle">
          The new application root will be: <b>{newAppRoot}</b> and this action will reboot the
          device.
        </p>
        <div className="app-root-change-button-group">
          <Button
            type="secondary"
            className="app-root-change-button"
            onClick={onConfirmationCancel}>
            Cancel
          </Button>
          <Button
            className="app-root-change-button"
            type="ternary"
            onClick={async () => {
              addCustomApplicationRoot(newAppRoot);
              update("appRoot", newAppRoot);
              closeModal();
            }}>
            Confirm
          </Button>
        </div>
      </div>
    );
  };

  const onAppRootChange = (newAppRoot: string | undefined) => {
    if (newAppRoot === undefined) {
      newAppRoot = "Auto";
    }
    openModal("", <AppRootChangeConfirmationView newAppRoot={newAppRoot} />);
  };

  const onCustomAppRootChange = () => {
    setCustomAppRootButtonDisabled(!customAppRootInputRef.current?.value);
  };

  const onAddNewAppRoot = () => {
    let newAppRoot = customAppRootInputRef.current?.value ?? "";
    openModal("", <CustomAppRootConfirmationView newAppRoot={newAppRoot} />);
  };

  const availableAppRoots = applicationRoots.map((applicationRoot) => {
    return { value: applicationRoot, label: applicationRoot };
  });

  availableAppRoots.push({ value: "Auto", label: "Auto" });

  return (
    <div className="launch-configuration-container">
      <div className="setting-description">AppRoot:</div>
      <Select
        value={appRoot ?? "Auto"}
        onChange={onAppRootChange}
        items={availableAppRoots}
        className="scheme"
      />
      <div className="setting-description">Add Custom Application Root:</div>
      <div className="custom-app-root-container">
        <input
          ref={customAppRootInputRef}
          onChange={onCustomAppRootChange}
          className="input-configuration custom-app-root-input"
          type="string"
          placeholder={"Custom/Application/Root/Path"}
        />
        <Button
          type="ternary"
          className="custom-app-root-button"
          disabled={customAppRootButtonDisabled}
          onClick={onAddNewAppRoot}>
          <span className="codicon codicon-add" />
        </Button>
      </div>
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
    <div className="launch-configuration-container">
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
    <div className="launch-configuration-container">
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

  const profile = eas?.[platform]?.profile;
  const buildUUID = eas?.[platform]?.buildUUID;

  const [selectedProfile, setSelectedProfile] = useState<string>(() => {
    if (profile === undefined) {
      return DISABLED;
    }
    if (!(profile in easBuildProfiles)) {
      return CUSTOM;
    }
    return profile;
  });

  const buildUUIDInputRef = useRef<HTMLInputElement>(null);
  const customBuildProfileInputRef = useRef<HTMLInputElement>(null);

  const updateEasConfig = (configUpdate: Partial<EasConfig>) => {
    const currentPlaftormConfig = eas?.[platform] ?? {};
    const newPlatformConfig = Object.fromEntries(
      Object.entries({ ...currentPlaftormConfig, ...configUpdate }).filter(([_k, v]) => !!v)
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
    setSelectedProfile(newProfile);

    if (newProfile === DISABLED) {
      updateEasConfig({ profile: undefined, buildUUID: undefined });
      return;
    }

    if (newProfile === CUSTOM) {
      newProfile = customBuildProfileInputRef.current?.value ?? profile ?? "";
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

  return (
    <div className="launch-configuration-container">
      <div className="setting-description">{prettyPlatformName(platform)} Build Profile:</div>
      <Select
        value={selectedProfile}
        onChange={onProfileSelectionChange}
        items={availableEasBuildProfiles}
        className="scheme"
      />
      {selectedProfile === CUSTOM && (
        <>
          <div className="setting-description">
            {prettyPlatformName(platform)} Custom Build Profile:
          </div>
          <Input
            ref={customBuildProfileInputRef}
            className="input-configuration"
            type="string"
            defaultValue={profile ?? ""}
            placeholder="Enter the build profile to be used"
            onBlur={onCustomBuildProfileInputBlur}
          />
        </>
      )}
      {selectedProfile !== DISABLED && (
        <>
          <div className="setting-description">{prettyPlatformName(platform)} Build UUID:</div>
          <Input
            ref={buildUUIDInputRef}
            className="input-configuration"
            type="string"
            defaultValue={buildUUID ?? ""}
            placeholder="Auto (the latest available build will be used)"
            onBlur={onBuildUUIDInputBlur}
          />
        </>
      )}
    </div>
  );
}

export default LaunchConfigurationView;
