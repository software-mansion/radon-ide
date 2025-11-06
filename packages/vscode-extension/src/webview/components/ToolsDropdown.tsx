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
import { ProjectInterface } from "../../common/Project";
import Tooltip from "./shared/Tooltip";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";
import { use$ } from "@legendapp/state/react";
import { ToolsState, ToolState } from "../../common/State";
import { observable } from "@legendapp/state";

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
          <IconButton
            onClick={onSelect}
            dataTest={`dev-tool-${label.toLowerCase().replaceAll(" ", "-")}-open-button`}>
            <span className="codicon codicon-link-external" />
          </IconButton>
        )}
        <Switch.Root
          disabled={!enabled}
          className="switch-root small-switch"
          data-testid={`dev-tool-${label.toLowerCase().replaceAll(" ", "-")}`}
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
  const selectedDeviceSessionState = useSelectedDeviceSessionState();
  const selectedDeviceSessionStatus = use$(selectedDeviceSessionState.status);

  const { project } = useProject();

  const isRunning = selectedDeviceSessionStatus === "running";

  const profilingCPUState = use$(selectedDeviceSessionState?.applicationSession.profilingCPUState);
  const profilingReactState = use$(
    selectedDeviceSessionState?.applicationSession.profilingReactState
  );

  const toolsState = use$(
    isRunning
      ? selectedDeviceSessionState?.applicationSession.toolsState
      : observable<ToolsState>({})
  );

  const allTools = Object.entries(toolsState ?? {});
  const panelTools = allTools.filter(([key, tool]) => tool.isPanelTool);
  const nonPanelTools = allTools.filter(([key, tool]) => !tool.isPanelTool);

  const isProfilingCPU = isRunning && profilingCPUState !== "stopped";
  const isProfilingReact = isRunning && profilingReactState !== "stopped";

  return (
    <DropdownMenuRoot>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-menu-content device-settings-content"
          data-testid="radon-tools-dropdown-menu"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <h4 className="device-settings-heading">Tools</h4>
          <Label>Testing</Label>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            data-testid="tools-dropdown-menu-maestro-test-button"
            onSelect={() => {
              const fileDialogPromise = project.openSelectMaestroFileDialog();
              fileDialogPromise.then((fileNames) => {
                if (fileNames) {
                  project.startMaestroTest(fileNames);
                }
              });
            }}>
            <span className="codicon codicon-github-action" />
            Start Maestro test(s)...
          </DropdownMenu.Item>

          <Label>Utilities</Label>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            data-testid="tools-dropdown-menu-cpu-profiling-button"
            onSelect={() =>
              isProfilingCPU ? project.stopProfilingCPU() : project.startProfilingCPU()
            }>
            <span className="codicon codicon-chip" />
            {isProfilingCPU ? "Stop JS CPU Profiler" : "Start JS CPU Profiler"}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            data-testid="tools-dropdown-menu-react-profiling-button"
            onSelect={() =>
              isProfilingReact ? project.stopProfilingReact() : project.startProfilingReact()
            }>
            <span className="codicon codicon-react" />
            {isProfilingReact ? "Stop React Profiler" : "Start React Profiler"}
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
