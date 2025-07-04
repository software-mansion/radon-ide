import * as Select from "@radix-ui/react-select";
import "./AppRootSelect.css";
import "./shared/Dropdown.css";
import _ from "lodash";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { useProject } from "../providers/ProjectProvider";
import { LaunchConfigurationOptions } from "../../common/LaunchConfig";
import RichSelectItem from "./shared/RichSelectItem";

function displayNameForConfig(config: LaunchConfigurationOptions) {
  if (config.name === "Radon IDE panel") {
    return undefined;
  }
  return config.name;
}

function renderLaunchConfigurations(
  groupLabel: string,
  prefix: string,
  customLaunchConfigurations: LaunchConfigurationOptions[],
  selectedValue: string | undefined
) {
  if (customLaunchConfigurations.length === 0) {
    return null;
  }

  return (
    <Select.Group>
      <Select.Label className="approot-select-label">{groupLabel}</Select.Label>
      {customLaunchConfigurations.map((config, idx) => (
        <RichSelectItem
          className="approot-select-item"
          value={`${prefix}:${idx}`}
          key={idx}
          icon={<span className="codicon codicon-folder" />}
          title={displayNameForConfig(config) ?? config.appRoot ?? "./"}
          subtitle={displayNameForConfig(config) ? config.appRoot : undefined}
          isSelected={selectedValue === `${prefix}:${idx}`}
        />
      ))}
    </Select.Group>
  );
}

function renderDetectedLaunchConfigurations(
  detectedConfigurations: LaunchConfigurationOptions[],
  selectedValue: string | undefined
) {
  if (detectedConfigurations.length === 0) {
    return null;
  }

  return renderLaunchConfigurations(
    "Detected applications",
    "detected",
    detectedConfigurations,
    selectedValue
  );
}

function renderCustomLaunchConfigurations(
  customLaunchConfigurations: LaunchConfigurationOptions[],
  selectedValue: string | undefined
) {
  if (customLaunchConfigurations.length === 0) {
    return null;
  }

  return renderLaunchConfigurations(
    "Custom configurations",
    "custom",
    customLaunchConfigurations,
    selectedValue
  );
}

function AppRootSelect() {
  const { applicationRoots } = useLaunchConfig();
  const { projectState, project } = useProject();
  const { selectedLaunchConfiguration, customLaunchConfigurations } = projectState;
  const selectedAppRootPath = projectState.appRootPath;
  const selectedAppRoot = applicationRoots.find((root) => root.path === selectedAppRootPath);

  const detectedConfigurations: LaunchConfigurationOptions[] = applicationRoots.map(
    ({ path, displayName, name }) => {
      return {
        appRoot: path,
        name: displayName || name,
      };
    }
  );

  const handleAppRootChange = async (value: string) => {
    const index = parseInt(value.split(":")[1], 10);
    const configs = value.startsWith("detected:")
      ? detectedConfigurations
      : customLaunchConfigurations;
    const launchConfiguration = configs[index];
    project.setLaunchConfiguration(launchConfiguration);
  };

  const selectedAppRootName =
    selectedAppRoot?.displayName ?? selectedAppRoot?.name ?? selectedAppRootPath;
  const selectedConfigName = displayNameForConfig(selectedLaunchConfiguration);
  const value = selectedConfigName ?? selectedAppRootName;

  const selectedValue = (() => {
    if (selectedLaunchConfiguration) {
      const index = customLaunchConfigurations.findIndex((config) =>
        _.isEqual(config, selectedLaunchConfiguration)
      );
      if (index !== -1) {
        return `custom:${index}`;
      }
    }
    const index = detectedConfigurations.findIndex(
      (config) => config.appRoot === selectedAppRootPath
    );
    return index !== -1 ? `detected:${index}` : undefined;
  })();

  return (
    <Select.Root onValueChange={handleAppRootChange} value={selectedAppRootPath}>
      <Select.Trigger className="approot-select-trigger" disabled={applicationRoots.length === 0}>
        <Select.Value placeholder="No applications found">
          <div className="approot-select-value">
            <span className="codicon codicon-folder-opened" />
            <span className="approot-select-value-text">{value}</span>
          </div>
        </Select.Value>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="approot-select-content"
          position="popper"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <Select.ScrollUpButton className="approot-select-scroll">
            <span className="codicon codicon-chevron-up" />
          </Select.ScrollUpButton>
          <Select.Viewport className="approot-select-viewport">
            {renderDetectedLaunchConfigurations(detectedConfigurations, selectedValue)}
            {renderCustomLaunchConfigurations(customLaunchConfigurations, selectedValue)}
          </Select.Viewport>
          <Select.ScrollDownButton className="approot-select-scroll">
            <span className="codicon codicon-chevron-down" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default AppRootSelect;
