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
  const { showPanelInSideBar } = useWorkspaceConfig();
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

          <DropdownMenu.Separator className="dropdown-menu-separator" />
          {/* TODO: add this option back when its fully working
          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              // @ts-ignore TODO fix this
              openModal("Manage Android SDKs", <AndroidImagesView />);
            }}>
            Manage Android SDKs...
          </DropdownMenu.Item> */}

          <DropdownMenu.Item
            className="dropdown-menu-item"
            onSelect={() => {
              project.restart(true);
            }}>
            <span className="codicon codicon-trash" />
            Clean rebuild
          </DropdownMenu.Item>

          {showPanelInSideBar && (
            <>
              <DropdownMenu.Separator className="dropdown-menu-separator" />
              <DropdownMenu.Item
                className="dropdown-menu-item"
                onSelect={() => {
                  project.focusIntoSecondarySidebar();
                  openModal(
                    "Move to secondary sidebar",
                    <div>
                      You can move extensions from Primary to secondary sidebar, by grab and droping
                      them.{" "}
                    </div>
                  );
                }}>
                <span className="codicon codicon-info" />
                Move to secondary sidebar
              </DropdownMenu.Item>
            </>
          )}
          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default SettingsDropdown;
