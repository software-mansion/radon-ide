import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { PropsWithChildren, useEffect, useState } from "react";

export function DropdownMenuRoot({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const blurListener = () => {
      setOpen(false);
    };
    window.addEventListener("blur", blurListener);
    return () => {
      window.removeEventListener("blur", blurListener);
    };
  }, []);

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={() => {
        setOpen(!open);
      }}>
      {children}
    </DropdownMenu.Root>
  );
}
