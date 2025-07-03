import * as Select from "@radix-ui/react-select";
import "./AppRootSelect.css";
import "./shared/Dropdown.css";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { useProject } from "../providers/ProjectProvider";
import { ApplicationRoot, LaunchConfiguration } from "../../common/LaunchConfig";
import RichSelectItem from "./shared/RichSelectItem";
import _ from "lodash";

function renderAppRoots(
  applicationRoots: ApplicationRoot[],
  selectedAppRootPath: string | undefined
) {
  if (applicationRoots.length === 0) {
    return null;
  }

  return (
    <Select.Group>
      <Select.Label className="approot-select-label">Select application</Select.Label>
      {applicationRoots.map(({ path, displayName, name }) => (
        <RichSelectItem
          className="approot-select-item"
          value={`approot:${path}`}
          key={path}
          icon={<span className="codicon codicon-folder" />}
          title={displayName || name}
          subtitle={path}
          isSelected={path === selectedAppRootPath}
        />
      ))}
    </Select.Group>
  );
}

function renderLaunchConfigurations(
  customLaunchConfigurations: LaunchConfiguration[],
  selectedLaunchConfiguration: LaunchConfiguration
) {
  if (customLaunchConfigurations.length === 0) {
    return null;
  }

  return (
    <Select.Group>
      <Select.Label className="approot-select-label">Custom configurations</Select.Label>
      {customLaunchConfigurations.map((config, idx) => (
        <RichSelectItem
          className="approot-select-item"
          value={`custom:${idx}`}
          key={idx}
          icon={<span className="codicon codicon-file" />}
          title={config.appRoot}
          subtitle={config.appRoot}
          isSelected={_.isEqual(selectedLaunchConfiguration, config)}
        />
      ))}
    </Select.Group>
  );
}

function AppRootSelect() {
  const { applicationRoots } = useLaunchConfig();
  const { projectState, project } = useProject();
  const { selectedLaunchConfiguration, customLaunchConfigurations } = projectState;
  const selectedAppRootPath = projectState.appRootPath;
  const selectedAppRoot = applicationRoots.find((root) => root.path === selectedAppRootPath);
  const selectedAppRootName =
    selectedAppRoot?.displayName ?? selectedAppRoot?.name ?? selectedAppRootPath;

  const handleAppRootChange = async (value: string) => {
    const launchConfiguration = value.startsWith("approot:")
      ? {
          appRoot: value.slice("approot:".length),
          env: {},
          preview: { waitForAppLaunch: true },
        }
      : customLaunchConfigurations[parseInt(value.slice("custom:".length), 10)];
    project.setLaunchConfiguration(launchConfiguration);
  };

  return (
    <Select.Root onValueChange={handleAppRootChange} value={selectedAppRootPath}>
      <Select.Trigger className="approot-select-trigger" disabled={applicationRoots.length === 0}>
        <Select.Value placeholder="No applications found">
          <div className="approot-select-value">
            <span className="codicon codicon-folder-opened" />
            <span className="approot-select-value-text">{selectedAppRootName}</span>
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
            {renderAppRoots(applicationRoots, selectedAppRootPath)}
            {renderLaunchConfigurations(customLaunchConfigurations, selectedLaunchConfiguration)}
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
