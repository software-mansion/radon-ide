import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./shared/Dropdown.css";
import { useModal } from "../providers/ModalProvider";
import DiagnosticView from "../views/DiagnosticView";
import ManageDevicesView from "../views/ManageDevicesView";
import { ProjectInterface } from "../../common/Project";
import DoctorIcon from "./icons/DoctorIcon";
import { useWorkspaceConfig } from "../providers/WorkspaceConfigProvider";

interface SettingsDropdownProps {
  children: React.ReactNode;
  project: ProjectInterface;
  disabled?: boolean;
}

function SettingsDropdown({ project, children, disabled }: SettingsDropdownProps) {
  const { panelLocation, updateUserLevel } = useWorkspaceConfig();
  const { openModal } = useModal();
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
            <DoctorIcon />
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
                  onSelect={() => updateUserLevel("panelLocation", "tab")}>
                  <span className="codicon codicon-layout-centered" />
                  Editor tab
                  {panelLocation === "tab" && <span className="codicon codicon-check right-slot" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => updateUserLevel("panelLocation", "side-panel")}>
                  <span className="codicon codicon-layout-sidebar-right" />
                  Side panel
                  {panelLocation === "side-panel" && (
                    <span className="codicon codicon-check right-slot" />
                  )}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="dropdown-menu-item"
                  onSelect={() => {
                    updateUserLevel("panelLocation", "secondary-side-panel");
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
