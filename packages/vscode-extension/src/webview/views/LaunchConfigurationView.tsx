import "./View.css";
import "./LaunchConfigurationView.css";
import { useRef } from "react";
import Label from "../components/shared/Label";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { LaunchConfigUpdater, LaunchConfigurationOptions } from "../../common/LaunchConfig";
import Select from "../components/shared/Select";
import { Input } from "../components/shared/Input";

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
      <AppRootConfiguration appRoot={appRoot} update={update} />
      <div className="launch-configuration-section-margin" />

      <Label>metro Config Path</Label>
      <MetroConfigPathConfiguration metroConfigPath={metroConfigPath} update={update} />

      <div className="launch-configuration-section-margin" />

      <Label>is Expo</Label>
      <IsExpoConfiguration isExpo={isExpo} update={update} />

      <div className="launch-configuration-section-margin" />

      {easBuildProfiles.length > 0 && (
        <>
          <Label>eas Build</Label>
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
}

function AppRootConfiguration({ appRoot, update }: appRootConfigurationProps) {
  const appRootInputRef = useRef<HTMLInputElement>(null);

  const onAppRootBlur = () => {
    let newAppRoot = appRootInputRef.current?.value;
    if (newAppRoot !== "") {
      newAppRoot = "Auto";
    }
    update("appRoot", newAppRoot);
  };

  return (
    <div className="launch-configuration-container">
      <div className="setting-description">App Root:</div>
      <Input
        ref={appRootInputRef}
        className="input-configuration"
        type="string"
        defaultValue={appRoot ?? "Auto"}
        onBlur={onAppRootBlur}
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

type EasConfig = NonNullable<LaunchConfigurationOptions["eas"]>;
type EasPlatform = keyof EasConfig;

function prettyPlatformName(platform: EasPlatform): string {
  switch (platform) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
  }
}

interface easBuildConfigurationProps {
  eas?: EasConfig;
  platform: EasPlatform;
  update: LaunchConfigUpdater;
  easBuildProfiles: string[];
}

function EasBuildConfiguration({
  eas,
  platform,
  update,
  easBuildProfiles,
}: easBuildConfigurationProps) {
  const DISABLED = "Disabled" as const;

  const profile = eas?.[platform]?.profile;
  const buildUUID = eas?.[platform]?.buildUUID;

  const buildUUIDInputRef = useRef<HTMLInputElement>(null);

  const onSchemeChange = (newProfile: string) => {
    if (newProfile === DISABLED) {
      let newEasConfig: EasConfig | undefined = { ...eas, [platform]: undefined };
      update("eas", newEasConfig);
      return;
    }

    const newBuildUUID = buildUUIDInputRef.current?.value || undefined;

    update("eas", {
      ...eas,
      [platform]: { profile: newProfile, buildUUID: newBuildUUID },
    });
  };

  const onBuildUUIDInputBlur = () => {
    let newBuildUUID = buildUUIDInputRef.current?.value || undefined;
    const platformConfig = eas?.[platform];
    if (platformConfig === undefined) {
      return;
    }
    const newPlatformConfig = { ...platformConfig, buildUUID: newBuildUUID };
    update("eas", { ...eas, [platform]: newPlatformConfig });
  };

  const availableEasBuildProfiles = easBuildProfiles.map((buildProfile) => {
    return { value: buildProfile, label: buildProfile };
  });

  availableEasBuildProfiles.push({ value: DISABLED, label: DISABLED });

  return (
    <div className="launch-configuration-container">
      <div className="setting-description">{prettyPlatformName(platform)} Build Profile:</div>
      <Select
        value={profile ?? DISABLED}
        onChange={onSchemeChange}
        items={availableEasBuildProfiles}
        className="scheme"
      />
      {profile !== undefined && (
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
