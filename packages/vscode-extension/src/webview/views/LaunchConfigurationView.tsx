import "./View.css";
import "./LaunchConfigurationView.css";
import Label from "../components/shared/Label";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { LaunchConfigurationOptions } from "../../common/LaunchConfig";
import Select from "../components/shared/Select";
import { useRef } from "react";
import { valid } from "semver";

function LaunchConfigurationView() {
  const { android, appRoot, ios, isExpo, metroConfigPath, env, update, xcodeSchemes } =
    useLaunchConfig();

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
    </>
  );
}

interface iosConfigurationProps {
  scheme?: string;
  configuration?: string;
  update: <K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K]
  ) => void;
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
    if (newConfiguration === "Auto" || !newConfiguration) {
      newConfiguration = undefined;
    }
    update("ios", { scheme, configuration: newConfiguration });
  };

  const availableXcodeSchemes = xcodeSchemes.map((xcodeScheme) => {
    return { value: xcodeScheme, label: xcodeScheme };
  });

  availableXcodeSchemes.push({ value: "Auto", label: "Auto" });

  return (
    <div className="container">
      <div className="setting-description">Scheme:</div>
      <Select
        value={scheme ?? "Auto"}
        onChange={onSchemeChange}
        items={availableXcodeSchemes}
        className="scheme"
      />
      <div className="setting-description">Configuration:</div>
      <input
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
  update: <K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K]
  ) => void;
}

function AndroidConfiguration({ buildType, productFlavor, update }: androidConfigurationProps) {
  const buildTypeInputRef = useRef<HTMLInputElement>(null);
  const productFlavorInputRef = useRef<HTMLInputElement>(null);

  const onBuildTypeBlur = () => {
    let newBuildType = buildTypeInputRef.current?.value;
    if (newBuildType === "Auto" || !newBuildType) {
      newBuildType = undefined;
    }
    update("android", { buildType: newBuildType, productFlavor });
  };

  const onProductFlavorBlur = () => {
    let newProductFlavor = productFlavorInputRef.current?.value;
    if (newProductFlavor === "Auto" || !newProductFlavor) {
      newProductFlavor = undefined;
    }
    update("android", { buildType, productFlavor: newProductFlavor });
  };

  return (
    <div className="container">
      <div className="setting-description">Build Type:</div>
      <input
        ref={buildTypeInputRef}
        className="input-configuration"
        type="string"
        defaultValue={buildType ?? "Auto"}
        onBlur={onBuildTypeBlur}
      />
      <div className="setting-description">Product Flavor:</div>
      <input
        ref={productFlavorInputRef}
        className="input-configuration"
        type="string"
        defaultValue={productFlavor ?? "Auto"}
        onBlur={onProductFlavorBlur}
      />
    </div>
  );
}

interface appRootConfigurationProps {
  appRoot?: string;
  update: <K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K]
  ) => void;
}

function AppRootConfiguration({ appRoot, update }: appRootConfigurationProps) {
  const appRootInputRef = useRef<HTMLInputElement>(null);

  const onAppRootBlur = () => {
    let newAppRoot = appRootInputRef.current?.value;
    if (!newAppRoot) {
      newAppRoot = "Auto";
    }
    update("appRoot", newAppRoot);
  };

  return (
    <div className="container">
      <div className="setting-description">App Root:</div>
      <input
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
  update: <K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K]
  ) => void;
}

function MetroConfigPathConfiguration({ metroConfigPath, update }: metroPathConfigurationProps) {
  const metroPathInputRef = useRef<HTMLInputElement>(null);

  const onMetroPathBlur = () => {
    let newMetroPath = metroPathInputRef.current?.value;
    if (!newMetroPath) {
      newMetroPath = "Auto";
    }
    update("metroConfigPath", newMetroPath);
  };

  return (
    <div className="container">
      <div className="setting-description">Metro Config Path:</div>
      <input
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
  update: <K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K]
  ) => void;
}

function IsExpoConfiguration({ isExpo, update }: isExpoConfigurationProps) {
  const options = [
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
    { value: "Auto", label: "Auto" },
  ];

  const onIsExpoChange = (newIsExpo: string) => {
    let updatedIsExpo: string | boolean = "Auto";
    if (newIsExpo === "true") {
      updatedIsExpo = true;
    } else if (newIsExpo === "false") {
      updatedIsExpo = false;
    }
    // @ts-ignore
    update("isExpo", updatedIsExpo);
  };

  return (
    <div className="container">
      <div className="setting-description">Is Expo:</div>
      <Select
        value={isExpo !== undefined ? isExpo.toString() : "Auto"}
        onChange={onIsExpoChange}
        items={options}
        className="scheme"
      />
    </div>
  );
}

export default LaunchConfigurationView;
