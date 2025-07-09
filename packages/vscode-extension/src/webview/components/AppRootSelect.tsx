import * as Select from "@radix-ui/react-select";
import "./AppRootSelect.css";
import "./shared/Dropdown.css";
import _ from "lodash";
import React, { PropsWithChildren, useEffect } from "react";
import { useProject } from "../providers/ProjectProvider";
import {
  LaunchConfiguration,
  LaunchConfigurationKind,
  LaunchConfigurationOptions,
} from "../../common/LaunchConfig";
import RichSelectItem from "./shared/RichSelectItem";
import { useModal } from "../providers/ModalProvider";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { useApplicationRoots } from "../providers/ApplicationRootsProvider";
import IconButton from "./shared/IconButton";
import { useAlert } from "../providers/AlertProvider";

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

function useUnknownConfigurationAlert(shouldOpen: boolean) {
  const { openAlert, closeAlert, isOpen } = useAlert();

  const alertId = "unknown-launch-configuration-alert";

  useEffect(() => {
    if (shouldOpen && !isOpen(alertId)) {
      openAlert({
        id: alertId,
        title: "Unknown launch configuration",
        description:
          "The selected launch configration is no longer specified in the workspace's launch.json file. " +
          "Radon IDE will continue to use the last selected configuration, but you may want to select a different one.",
        actions: (
          <IconButton
            type="secondary"
            onClick={() => closeAlert(alertId)}
            tooltip={{ label: "Close notification", side: "bottom" }}>
            <span className="codicon codicon-close" />
          </IconButton>
        ),
      });
    } else if (!shouldOpen && isOpen(alertId)) {
      closeAlert(alertId);
    }
  }, [shouldOpen]);
}

function AppRootSelect() {
  const applicationRoots = useApplicationRoots();
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
        kind: LaunchConfigurationKind.Detected,
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

  const selectedValue = (() => {
    if (selectedConfiguration.kind === LaunchConfigurationKind.Custom) {
      const index = customConfigurations.findIndex((config) =>
        _.isEqual(config, selectedConfiguration)
      );
      return index !== -1 ? `custom:${index}` : "unknown";
    } else {
      const index = detectedConfigurations.findIndex(
        (config) => config.appRoot === selectedAppRootPath
      );
      return index !== -1 ? `detected:${index}` : "unknown";
    }
  })();

  useUnknownConfigurationAlert(selectedValue === "unknown");

  const configurationsCount = detectedConfigurations.length + customConfigurations.length;
  const placeholder = configurationsCount === 0 ? "No applications found" : "Select application";
  const selectedAppRootName =
    selectedAppRoot?.displayName ?? selectedAppRoot?.name ?? selectedAppRootPath;
  const selectedConfigName = displayNameForConfig(selectedConfiguration);
  const value = selectedConfigName ?? selectedAppRootName ?? placeholder;

  return (
    <Select.Root onValueChange={handleAppRootChange} value={selectedValue}>
      <Select.Trigger className="approot-select-trigger" disabled={configurationsCount === 0}>
        <Select.Value placeholder={placeholder}>
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
            {configurationsCount > 0 && <Select.Separator className="approot-select-separator" />}
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
