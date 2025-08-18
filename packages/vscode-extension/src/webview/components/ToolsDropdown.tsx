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
import { ProjectInterface, ToolState } from "../../common/Project";
import Tooltip from "./shared/Tooltip";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";
import { use$ } from "@legendapp/state/react";

interface DevToolCheckboxProps {
  label: string;
  checked: boolean;
  isPanelTool: boolean;
  enabled: boolean;
  pluginUnavailableTooltip?: string;
  onCheckedChange: (checked: boolean) => void;
  onSelect: () => void;
}

function DevToolCheckbox({
  label,
  checked,
  isPanelTool,
  enabled,
  pluginUnavailableTooltip,
  onCheckedChange,
  onSelect,
}: DevToolCheckboxProps) {
  return (
    <Tooltip label={pluginUnavailableTooltip} disabled={enabled}>
      <div
        className="dropdown-menu-item"
        style={{ color: enabled ? "inherit" : "var(--swm-disabled-text)" }}>
        {label}
        {checked && isPanelTool && (
          <IconButton onClick={onSelect}>
            <span className="codicon codicon-link-external" />
          </IconButton>
        )}
        <Switch.Root
          disabled={!enabled}
          className="switch-root small-switch"
          onCheckedChange={onCheckedChange}
          defaultChecked={checked}
          style={{ marginLeft: "auto" }}>
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
    </Tooltip>
  );
}

function ToolsList({
  project,
  tools,
}: {
  project: ProjectInterface;
  tools: [string, ToolState][];
}) {
  return tools.map(([key, tool]) => (
    <DevToolCheckbox
      key={key}
      label={tool.label}
      checked={tool.enabled && tool.pluginAvailable}
      isPanelTool={tool.isPanelTool}
      enabled={tool.pluginAvailable}
      pluginUnavailableTooltip={tool.pluginUnavailableTooltip}
      onCheckedChange={async (checked) => {
        await project.updateToolEnabledState(key, checked);
        if (checked) {
          project.openTool(key);
        }
      }}
      onSelect={() => project.openTool(key)}
    />
  ));
}

function ToolsDropdown({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { project, selectedDeviceSession } = useProject();

  const isRunning = selectedDeviceSession?.status === "running";
  const toolsState = isRunning ? selectedDeviceSession.toolsState : {};

  const allTools = Object.entries(toolsState);
  const panelTools = allTools.filter(([key, tool]) => tool.isPanelTool);
  const nonPanelTools = allTools.filter(([key, tool]) => !tool.isPanelTool);

  const isProfilingCPU = isRunning && selectedDeviceSession.profilingCPUState !== "stopped";
  const isProfilingReact = isRunning && selectedDeviceSession.profilingReactState !== "stopped";

  const frameRateReportingEnabled = use$(useSelectedDeviceSessionState().frameReporting.enabled);

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
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() =>
              isProfilingReact ? project.stopProfilingReact() : project.startProfilingReact()
            }>
            <span className="codicon codicon-react" />

            {isProfilingReact ? "Stop React Profiler" : "Start React Profiler"}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() =>
              frameRateReportingEnabled
                ? project.stopFrameRateReporting()
                : project.startFrameRateReporting()
            }>
            <span className="codicon codicon-rocket" />

            {frameRateReportingEnabled ? "Stop Frame Rate Reporting" : "Start Frame Rate Reporting"}
          </DropdownMenu.Item>
          <ToolsList project={project} tools={nonPanelTools} />
          <Label>Tool Panels</Label>
          <ToolsList project={project} tools={panelTools} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuRoot>
  );
}

export default ToolsDropdown;
