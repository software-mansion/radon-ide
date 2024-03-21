import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import "./shared/Dropdown.css";
import { useModal } from "../providers/ModalProvider";

import DiagnosticView from "../views/DiagnosticView";
import AndroidImagesView from "../views/AndroidImagesView";
import ManageDevicesView from "../views/ManageDevicesView";
import { ProjectInterface } from "../../common/Project";
import DoctorIcon from "./icons/DoctorIcon";

interface SettingsDropdownProps {
  children: React.ReactNode;
  project: ProjectInterface;
  disabled?: boolean;
}

function SettingsDropdown({ project, children, disabled }: SettingsDropdownProps) {
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
          <DropdownMenu.Arrow className="dropdown-menu-arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default SettingsDropdown;
