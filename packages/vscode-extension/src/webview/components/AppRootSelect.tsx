import * as Select from "@radix-ui/react-select";
import "./AppRootSelect.css";
import "./shared/Dropdown.css";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { useProject } from "../providers/ProjectProvider";
import { ApplicationRoot } from "../../common/LaunchConfig";
import RichSelectItem from "./shared/RichSelectItem";

function renderAppRoots(
  applicationRoots: ApplicationRoot[],
  selectedAppRootPath: string | undefined
) {
  if (applicationRoots.length === 0) {
    return null;
  }

  return (
    <Select.Group>
      {applicationRoots.map(({ path, displayName, name }) => (
        <RichSelectItem
          value={path}
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

function AppRootSelect() {
  const { applicationRoots, update } = useLaunchConfig();
  const { projectState } = useProject();
  const selectedAppRootPath = projectState.appRootPath;
  const selectedAppRoot = applicationRoots.find((root) => root.path === selectedAppRootPath);
  const selectedAppRootName =
    selectedAppRoot?.displayName ?? selectedAppRoot?.name ?? selectedAppRootPath;

  const handleAppRootChange = async (value: string) => {
    update("appRoot", value);
  };

  return (
    <Select.Root onValueChange={handleAppRootChange} value={selectedAppRootPath}>
      <Select.Trigger className="approot-select-trigger" disabled={applicationRoots.length === 0}>
        <Select.Value placeholder="No applications found">
          <div className="approot-select-value">
            <span className="codicon codicon-folder-opened" />
            {selectedAppRootName}
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
