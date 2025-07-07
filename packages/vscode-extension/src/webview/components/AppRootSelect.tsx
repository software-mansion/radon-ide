import * as Select from "@radix-ui/react-select";
import "./AppRootSelect.css";
import "./shared/Dropdown.css";
import _ from "lodash";
import React, { PropsWithChildren } from "react";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { useProject } from "../providers/ProjectProvider";
import { LaunchConfiguration, LaunchConfigurationOptions } from "../../common/LaunchConfig";
import RichSelectItem from "./shared/RichSelectItem";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="rich-item approot-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  )
);

function displayNameForConfig(config: LaunchConfigurationOptions) {
  if (config.name === "Radon IDE panel") {
    return undefined;
  }
  return config.name;
}

function ConfigureButton({ onStopClick }: { onStopClick?: () => void }) {
  return (
    <div
      onPointerUpCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={onStopClick}>
      <span className="codicon codicon-gear" />
    </div>
  );
}

function renderLaunchConfigurations(
  groupLabel: string,
  prefix: string,
  customLaunchConfigurations: LaunchConfigurationOptions[],
  selectedValue: string | undefined,
  onEditConfig?: (config: LaunchConfiguration) => void
) {
  if (customLaunchConfigurations.length === 0) {
    return null;
  }

  return (
    <Select.Group>
      <Select.Label className="approot-select-label">{groupLabel}</Select.Label>
      {customLaunchConfigurations.map((config, idx) => (
        <RichSelectItem
          value={`${prefix}:${idx}`}
          key={idx}
          icon={<span className="codicon codicon-folder" />}
          title={displayNameForConfig(config) ?? config.appRoot ?? "./"}
          subtitle={displayNameForConfig(config) ? config.appRoot : undefined}
          isSelected={selectedValue === `${prefix}:${idx}`}>
          {onEditConfig && (
            <ConfigureButton onStopClick={() => onEditConfig(config as LaunchConfiguration)} />
          )}
        </RichSelectItem>
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
  selectedValue: string | undefined,
  onEditConfig: (config: LaunchConfiguration) => void
) {
  if (customLaunchConfigurations.length === 0) {
    return null;
  }

  return renderLaunchConfigurations(
    "Custom configurations",
    "custom",
    customLaunchConfigurations,
    selectedValue,
    onEditConfig
  );
}

function AppRootSelect() {
  const { applicationRoots } = useLaunchConfig();
  const { projectState, project } = useProject();
  const {
    selectedLaunchConfiguration: selectedConfiguration,
    customLaunchConfigurations: customConfigurations,
  } = projectState;
  const selectedAppRootPath = projectState.appRootPath;
  const selectedAppRoot = applicationRoots.find((root) => root.path === selectedAppRootPath);
  const { openModal } = useModal();

  function onEditConfig(config: LaunchConfiguration) {
    openModal("Launch Configuration", <LaunchConfigurationView launchConfigToUpdate={config} />);
  }

  const detectedConfigurations: LaunchConfigurationOptions[] = applicationRoots.map(
    ({ path, displayName, name }) => {
      return {
        appRoot: path,
        name: displayName || name,
      };
    }
  );

  const handleAppRootChange = async (value: string) => {
    if (value === "manage") {
      openModal("Launch Configuration", <LaunchConfigurationView />);
      return;
    }
    const index = parseInt(value.split(":")[1], 10);
    const configs = value.startsWith("detected:") ? detectedConfigurations : customConfigurations;
    const launchConfiguration = configs[index];
    console.assert(
      index < configs.length,
      "Index out of bounds for launch configurations %s",
      value
    );
    project.selectLaunchConfiguration(launchConfiguration);
  };

  const selectedAppRootName =
    selectedAppRoot?.displayName ?? selectedAppRoot?.name ?? selectedAppRootPath;
  const selectedConfigName = displayNameForConfig(selectedConfiguration);
  const value = selectedConfigName ?? selectedAppRootName;

  const selectedValue = (() => {
    if (selectedConfiguration) {
      const index = customConfigurations.findIndex((config) =>
        _.isEqual(config, selectedConfiguration)
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
    <Select.Root onValueChange={handleAppRootChange} value={selectedValue}>
      <Select.Trigger
        className="approot-select-trigger"
        disabled={detectedConfigurations.length + customConfigurations.length === 0}>
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
            {renderCustomLaunchConfigurations(customConfigurations, selectedValue, onEditConfig)}
            {detectedConfigurations.length + customConfigurations.length > 0 && (
              <Select.Separator className="approot-select-separator" />
            )}
            <SelectItem value="manage">
              <span className="codicon codicon-add" />
              <span> Add custom launch config</span>
            </SelectItem>
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
