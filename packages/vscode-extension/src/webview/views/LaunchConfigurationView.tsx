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

      <div className="launch-configuration-section-margin" />

      <Label>App Root</Label>

      <div className="launch-configuration-section-margin" />

      <Label>metro Config Path</Label>

      <div className="launch-configuration-section-margin" />

      <Label>is Expo</Label>

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

  const onSchemeChange = (newScheme: string) => {
    if (newScheme === "Auto") {
      update("ios", { scheme: undefined, configuration });
      return;
    }
    update("ios", { scheme: newScheme, configuration });
  };

  const onConfigurationBlur = () => {
    const newConfiguration = configurationInputRef.current?.value;
    if (newConfiguration === "Auto") {
      update("ios", { scheme, configuration: undefined });
      return;
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
        className="scheme"></Select>
      <div className="setting-description">Configuration:</div>
      <input
        ref={configurationInputRef}
        className="configuration"
        type="string"
        defaultValue={configuration ?? "Auto"}
        onBlur={onConfigurationBlur}
      />
    </div>
  );
}

function AndroidConfiguration() {}
function AppRootConfiguration() {}
function MetroConfigPathConfiguration() {}
function IsExpoConfiguration() {}

export default LaunchConfigurationView;
