import React, { PropsWithChildren } from "react";
import * as Select from "@radix-ui/react-select";
import "./DeviceSelect.css";
import "./shared/Dropdown.css";
import Tooltip from "./shared/Tooltip";
import { useLaunchConfig } from "../providers/LaunchConfigProvider";
import { useProject } from "../providers/ProjectProvider";

interface RichSelectItemProps extends Select.SelectItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isSelected?: boolean;
}

const RichSelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<RichSelectItemProps>>(
  ({ children, icon, title, subtitle, isSelected, ...props }, forwardedRef) => {
    function renderSubtitle() {
      if (!subtitle) {
        return null;
      }

      const subtitleComponent = <div className="device-select-rich-item-subtitle">{subtitle}</div>;
      const isLongText = subtitle.length > 20;

      if (isLongText) {
        <Tooltip label={subtitle} side="right" instant>
          {subtitleComponent}
        </Tooltip>;
      }
      return subtitleComponent;
    }

    return (
      <Select.Item className="device-select-rich-item" {...props} ref={forwardedRef}>
        <div
          className={
            isSelected ? "device-select-rich-item-icon-selected" : "device-select-rich-item-icon"
          }>
          {icon}
        </div>
        <div>
          {isSelected ? (
            <div className="device-select-rich-item-title">
              <b>{title}</b>
            </div>
          ) : (
            <div className="device-select-rich-item-title">{title}</div>
          )}

          {renderSubtitle()}
        </div>
      </Select.Item>
    );
  }
);

function renderAppRoots() {
  const { applicationRoots, appRoot } = useLaunchConfig();
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
          isSelected={path === appRoot}
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
      <Select.Trigger className="device-select-trigger" disabled={applicationRoots.length === 0}>
        <Select.Value placeholder="No applications found">
          <div className="device-select-value">
            <span className="codicon codicon-folder-opened" />
            {selectedAppRootName}
          </div>
        </Select.Value>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="device-select-content"
          position="popper"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <Select.ScrollUpButton className="device-select-scroll">
            <span className="codicon codicon-chevron-up" />
          </Select.ScrollUpButton>
          <Select.Viewport className="device-select-viewport">{renderAppRoots()}</Select.Viewport>
          <Select.ScrollDownButton className="device-select-scroll">
            <span className="codicon codicon-chevron-down" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default AppRootSelect;
