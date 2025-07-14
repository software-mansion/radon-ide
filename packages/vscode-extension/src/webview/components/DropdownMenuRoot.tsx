import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { PropsWithChildren, useEffect, useState } from "react";

interface DropdownMenuRootProps extends PropsWithChildren {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DropdownMenuRoot({ children, open: openExternal, onOpenChange }: DropdownMenuRootProps) {
  const [openInternal, setOpenInternal] = useState(false);

  const open = openExternal !== undefined ? openExternal : openInternal;

  const handleSetOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    }
    setOpenInternal(open);
  };

  useEffect(() => {
    const blurListener = () => {
      handleSetOpen(false);
    };
    window.addEventListener("blur", blurListener);
    return () => {
      window.removeEventListener("blur", blurListener);
    };
  }, []);

  return (
    <DropdownMenu.Root open={open} onOpenChange={handleSetOpen}>
      {children}
    </DropdownMenu.Root>
  );
}
