import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Switch from "@radix-ui/react-switch";

import "./shared/Dropdown.css";
import "./shared/SwitchGroup.css";
import "./ToolsDropdown.css";

import { useProject } from "../providers/ProjectProvider";
import IconButton from "./shared/IconButton";
import { DropdownMenuRoot } from "./DropdownMenuRoot";
import Label from "./shared/Label";
import { useDevices } from "../providers/DevicesProvider";
import { useSelectedDevice } from "../hooks/useSelectedDevice";
import { ToolState } from "../../common/DeviceSessionsManager";

interface DevToolCheckboxProps {
  label: string;
  checked: boolean;
  panelAvailable: boolean;
  onCheckedChange: (checked: boolean) => void;
  onSelect: () => void;
}

function DevToolCheckbox({
  label,
  checked,
  panelAvailable,
  onCheckedChange,
  onSelect,
}: DevToolCheckboxProps) {
  return (
    <div className="dropdown-menu-item">
      {label}
      {checked && panelAvailable && (
        <IconButton onClick={onSelect}>
          <span className="codicon codicon-link-external" />
        </IconButton>
      )}
      <Switch.Root
        className="switch-root small-switch"
        onCheckedChange={onCheckedChange}
        defaultChecked={checked}
        style={{ marginLeft: "auto" }}>
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
    </div>
  );
}

function ToolsList({ tools }: { tools: [string, ToolState][] }) {
  const { projectState } = useProject();
  const selectedDeviceId = projectState.selectedDevice;
  const { deviceSessionsManager } = useDevices();

  return tools.map(([key, tool]) => (
    <DevToolCheckbox
      key={key}
      label={tool.label}
      checked={tool.enabled}
      panelAvailable={tool.panelAvailable}
      onCheckedChange={async (checked) => {
        if (!selectedDeviceId) return;
        await deviceSessionsManager.updateToolEnabledState(selectedDeviceId, key, checked);
        if (checked) {
          deviceSessionsManager.openTool(selectedDeviceId, key);
        }
      }}
      onSelect={() => selectedDeviceId && deviceSessionsManager.openTool(selectedDeviceId, key)}
    />
  ));
}

function ToolsDropdown({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { projectState } = useProject();
  const selectedDeviceId = projectState.selectedDevice;
  const { deviceSessionsManager } = useDevices();
  const { toolsState, isProfilingCPU } = useSelectedDevice();

  const allTools = Object.entries(toolsState);
  const panelTools = allTools.filter(([key, tool]) => tool.panelAvailable);
  const nonPanelTools = allTools.filter(([key, tool]) => !tool.panelAvailable);

  return (
    <DropdownMenuRoot>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-menu-content device-settings-content"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <h4 className="device-settings-heading">Tools</h4>
          <Label>Utilities</Label>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() =>
              selectedDeviceId &&
              (isProfilingCPU
                ? deviceSessionsManager.stopProfilingCPU(selectedDeviceId)
                : deviceSessionsManager.startProfilingCPU(selectedDeviceId))
            }>
            <span className="codicon codicon-chip" />
            {isProfilingCPU ? "Stop JS CPU Profiler" : "Start JS CPU Profiler"}
          </DropdownMenu.Item>
          <ToolsList tools={nonPanelTools} />
          <Label>Tool Panels</Label>
          <ToolsList tools={panelTools} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuRoot>
  );
}

export default ToolsDropdown;
