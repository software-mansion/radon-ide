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

function ToolsDropdown({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { project, toolsState, isProfilingCPU } = useProject();

  const toolEntries = Object.entries(toolsState).map(([key, tool]) => {
    return (
      <DevToolCheckbox
        key={key}
        label={tool.label}
        checked={tool.enabled}
        panelAvailable={tool.panelAvailable}
        onCheckedChange={async (checked) => {
          await project.updateToolEnabledState(key, checked);
          if (checked) {
            project.openTool(key);
          }
        }}
        onSelect={() => project.openTool(key)}
      />
    );
  });

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
              isProfilingCPU ? project.stopProfilingCPU() : project.startProfilingCPU()
            }>
            <span className="codicon codicon-chip" />
            {isProfilingCPU ? "Stop JS CPU Profiler" : "Start JS CPU Profiler"}
          </DropdownMenu.Item>
          <Label>Tool Panels</Label>
          {toolEntries}
          {toolEntries.length === 0 && (
            <div className="tools-empty-message">
              Your app doesn't have any supported dev tools configured.&nbsp;
              <a href="https://ide.swmansion.com/docs/features/dev-tools">Learn more</a>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuRoot>
  );
}

export default ToolsDropdown;
