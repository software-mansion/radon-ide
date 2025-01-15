import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./shared/Dropdown.css";
import { useModal } from "../providers/ModalProvider";
import DiagnosticView from "../views/DiagnosticView";
import ManageDevicesView from "../views/ManageDevicesView";
import { ProjectInterface } from "../../common/Project";
import DoctorIcon from "./icons/DoctorIcon";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";
import { KeybindingInfo } from "./shared/KeybindingInfo";
import { useUtils } from "../providers/UtilsProvider";
import "./shared/SwitchGroup.css";
import LaunchConfigurationView from "../views/LaunchConfigurationView";
import { SendFeedbackItem } from "./SendFeedbackItem";
import { useTelemetry } from "../providers/TelemetryProvider";
import { DropdownMenuRoot } from "./DropdownMenuRoot";

interface SettingsDropdownProps {
  children: React.ReactNode;
  isDeviceRunning: boolean;
  project: ProjectInterface;
  disabled?: boolean;
}

function SettingsDropdown({ project, isDeviceRunning, children, disabled }: SettingsDropdownProps) {
  const { panelLocation, update } = useWorkspaceConfig();
  const { openModal } = useModal();
  const { movePanelToNewWindow, reportIssue } = useUtils();
  const { telemetryEnabled } = useTelemetry();

  return (
    <DropdownMenuRoot>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-menu-content"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              openModal("Diagnostics", <DiagnosticView />);
            }}>
            <DoctorIcon color="var(--swm-default-text)" />
            Run diagnostics...
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              openModal("Manage Devices", <ManageDevicesView />);
            }}>
            <span className="codicon codicon-device-mobile" />
            Manage devices...
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            disabled={!isDeviceRunning}
            onSelect={() => {
              project.openDevMenu();
            }}>
            <span className="dropdown-menu-item-wraper">
              <span className="codicon codicon-code" />
              <div className="dropdown-menu-item-content">
                Open dev menu
                <KeybindingInfo commandName="RNIDE.openDevMenu" />
              </div>
            </span>
          </DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="dropdown-menu-item">
              <span className="codicon codicon-layout" />
              Change IDE panel location
              <span className="codicon codicon-chevron-right right-slot" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="dropdown-menu-subcontent"
                sideOffset={2}
                alignOffset={-5}>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => update("panelLocation", "tab")}>
                  <span className="codicon codicon-layout-centered" />
                  Editor tab
                  {panelLocation === "tab" && <span className="codicon codicon-check right-slot" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => update("panelLocation", "side-panel")}>
                  <span className="codicon codicon-layout-sidebar-right" />
                  Side panel
                  {panelLocation === "side-panel" && (
                    <span className="codicon codicon-check right-slot" />
                  )}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => {
                    update("panelLocation", "secondary-side-panel");
                    openModal(
                      "Drag and drop to secondary side panel",
                      <div>
                        Drag and drop the IDE Panel by its icon from the side bar to move it to the
                        secondary panel.
                      </div>
                    );
                  }}>
                  <span className="codicon codicon-layout-sidebar-left" />
                  Secondary side panel
                  {panelLocation === "secondary-side-panel" && (
                    <span className="codicon codicon-check right-slot" />
                  )}
                </DropdownMenu.Item>
                {panelLocation === "tab" && (
                  <>
                    <DropdownMenu.Separator className="dropdown-menu-separator" />
                    <DropdownMenu.Item
                      className="dropdown-menu-item"
                      onSelect={() => {
                        movePanelToNewWindow();
                      }}>
                      <span className="codicon codicon-multiple-windows" />
                      New Window
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              openModal("Launch Configuration", <LaunchConfigurationView />);
            }}>
            <span className="codicon codicon-rocket" />
            Launch configuration...
          </DropdownMenu.Item>
          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              reportIssue();
            }}>
            <span className="dropdown-menu-item-wraper">
              <span className="codicon codicon-report" />
              <div className="dropdown-menu-item-content">Report Issue</div>
            </span>
          </DropdownMenu.Item>
          {telemetryEnabled && <SendFeedbackItem />}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuRoot>
  );
}

export default SettingsDropdown;
