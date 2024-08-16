import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./shared/Dropdown.css";
import { useModal } from "../providers/ModalProvider";
import DiagnosticView from "../views/DiagnosticView";
import ManageDevicesView from "../views/ManageDevicesView";
import DoctorIcon from "./icons/DoctorIcon";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";
import { useProject } from "../providers/ProjectProvider";
import { KeybindingInfo } from "./shared/KeybindingInfo";
import { useUtils } from "../providers/UtilsProvider";
import "./shared/SwitchGroup.css";

interface SettingsDropdownProps {
  children: React.ReactNode;
  isDeviceRunning: boolean;
  disabled?: boolean;
}

function SettingsDropdown({ isDeviceRunning, children, disabled }: SettingsDropdownProps) {
  const { panelLocation, update } = useWorkspaceConfig();
  const { projectState, project } = useProject();
  const { openModal } = useModal();
  const { movePanelToNewWindow } = useUtils();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-menu-content">
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
            <span className="codicon codicon-code" />
            <div className="dropdown-menu-item-content">
              Open dev menu
              <KeybindingInfo commandName="RNIDE.openDevMenu" />
            </div>
          </DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="dropdown-menu-item">
              <span className="codicon codicon-layout" />
              Change IDE panel location
              <span className="codicon codicon-chevron-right right-slot" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="dropdown-menu-content"
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

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="dropdown-menu-item">
              <span className="codicon codicon-debug" />
              Launch Configuration
              <span className="codicon codicon-chevron-right right-slot" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="dropdown-menu-content"
                sideOffset={2}
                alignOffset={-5}>
                {!!projectState.launchConfigurations.length ? (
                  projectState.launchConfigurations.map((launchConfig) => (
                    <DropdownMenu.Item
                      className="dropdown-menu-item"
                      onSelect={async () => {
                        await project.selectLaunchConfiguration(launchConfig);
                      }}>
                      <span className="codicon codicon-debug-console" />
                      {launchConfig.name}

                      {projectState.selectedLaunchConfiguration?.appRoot ===
                        launchConfig.appRoot && (
                        <span className="codicon codicon-check right-slot" />
                      )}
                    </DropdownMenu.Item>
                  ))
                ) : (
                  <DropdownMenu.Item
                    className="dropdown-menu-item"
                    onSelect={() => {
                      openModal(
                        "No launch configuration found",
                        <div>
                          <p>
                            No launch configuration found in your <code>launch.json</code> file.
                          </p>
                          <p>
                            To create a launch configuration, open the debug panel and click on the
                            gear icon.
                          </p>
                        </div>
                      );
                    }}>
                    <span className="codicon codicon-debug-console" />
                    No launch configuration found
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="dropdown-menu-separator" />

          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              project.restart(true);
            }}>
            <span className="codicon codicon-trash" />
            Clean rebuild
          </DropdownMenu.Item>

          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default SettingsDropdown;
