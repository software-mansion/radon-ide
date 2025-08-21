import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { use$ } from "@legendapp/state/react";
import "./shared/Dropdown.css";
import { useModal } from "../providers/ModalProvider";
import DiagnosticView from "../views/DiagnosticView";
import ManageDevicesView from "../views/ManageDevicesView";
import { ProjectInterface } from "../../common/Project";
import DoctorIcon from "./icons/DoctorIcon";
import { KeybindingInfo } from "./shared/KeybindingInfo";
import "./shared/SwitchGroup.css";
import { SendFeedbackItem } from "./SendFeedbackItem";
import { DropdownMenuRoot } from "./DropdownMenuRoot";
import { useStore } from "../providers/storeProvider";

interface SettingsDropdownProps {
  children: React.ReactNode;
  isDeviceRunning: boolean;
  project: ProjectInterface;
  disabled?: boolean;
}

function SettingsDropdown({ project, isDeviceRunning, children, disabled }: SettingsDropdownProps) {
  const store$ = useStore();
  const panelLocation = use$(store$.workspaceConfiguration.panelLocation);
  const telemetryEnabled = use$(store$.telemetry.enabled);

  const { openModal } = useModal();

  const extensionVersion = document.querySelector<HTMLMetaElement>(
    "meta[name='radon-ide-version']"
  )?.content;

  return (
    <DropdownMenuRoot>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-menu-content"
          data-test="radon-settings-dropdown-menu"
          onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            data-test="settings-dropdown-run-diagnostics-button"
            onSelect={() => {
              openModal("Diagnostics", <DiagnosticView />);
            }}>
            <DoctorIcon color="var(--swm-default-text)" />
            Run diagnostics...
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="dropdown-menu-item"
            data-test="settings-dropdown-manage-devices-button"
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
              Change IDE location
              <span className="codicon codicon-chevron-right right-slot" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="dropdown-menu-subcontent"
                sideOffset={2}
                alignOffset={-5}>
                {panelLocation !== "side-panel" && (
                  <DropdownMenu.Item
                    className="dropdown-menu-item"
                    onSelect={() => project.movePanelTo("side-panel")}>
                    <span className="codicon codicon-layout-sidebar-right" />
                    Move to Side Panel
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => project.movePanelTo("editor-tab")}>
                  <span className="codicon codicon-layout-centered" />
                  Move to Editor Tab
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => project.movePanelTo("new-window")}>
                  <span className="codicon codicon-multiple-windows" />
                  Move to New Window
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              project.reportIssue();
            }}>
            <span className="dropdown-menu-item-wraper">
              <span className="codicon codicon-report" />
              <div className="dropdown-menu-item-content">Report Issue</div>
            </span>
          </DropdownMenu.Item>
          {telemetryEnabled && <SendFeedbackItem />}
          <div className="dropdown-menu-item device-settings-version-text">
            Radon IDE version: {extensionVersion}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuRoot>
  );
}

export default SettingsDropdown;
