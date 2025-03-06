import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import "./shared/Dropdown.css";
import { DropdownMenuRoot } from "./DropdownMenuRoot";
import CheckIcon from "./icons/CheckIcon";

interface NetworkFiltersDropdownProps {
  children: React.ReactNode;
  disabled?: boolean;
}

function NetworkFiltersDropdown({ children, disabled }: NetworkFiltersDropdownProps) {
  const [checked, setChecked] = React.useState(true);
  return (
    <DropdownMenuRoot>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        {children}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="dropdown-menu-content">
          <DropdownMenu.CheckboxItem checked={checked} onCheckedChange={setChecked}>
            <DropdownMenu.ItemIndicator>
              <CheckIcon />
            </DropdownMenu.ItemIndicator>
            Hide data URLs
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={checked} onCheckedChange={setChecked}>
            <DropdownMenu.ItemIndicator>
              <CheckIcon />
            </DropdownMenu.ItemIndicator>
            Hide extension URLs
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={checked} onCheckedChange={setChecked}>
            <DropdownMenu.ItemIndicator>
              <CheckIcon />
            </DropdownMenu.ItemIndicator>
            Blocked response cookies
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={checked} onCheckedChange={setChecked}>
            <DropdownMenu.ItemIndicator>
              <CheckIcon />
            </DropdownMenu.ItemIndicator>
            Blocked requests
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={checked} onCheckedChange={setChecked}>
            <DropdownMenu.ItemIndicator>
              <CheckIcon />
            </DropdownMenu.ItemIndicator>
            3rd-party requests
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenuRoot>
  );
}

export default NetworkFiltersDropdown;
