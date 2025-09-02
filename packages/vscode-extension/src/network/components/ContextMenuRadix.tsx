import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { VscodeContextMenu as VscodeContextMenuElement } from "@vscode-elements/elements/dist/vscode-context-menu/vscode-context-menu";
import { VscodeContextMenu } from "@vscode-elements/react-elements";


interface MenuItemData {
  label: string;
  keybinding?: string;
  value?: string;
  separator?: boolean;
  tabindex?: number;
}

type Props = {
  data: MenuItemData[];
  ref: React.RefObject<VscodeContextMenuElement | null>;
  className?: string;
};

function ContextMenuPortal({ data, ref, className, ...props }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current = document.querySelector<HTMLDivElement>("#root");
    return () => {
      rootRef.current = null;
    };
  }, []);

  
  const handleContextMenu = (e: React.MouseEvent) => { 
    e.preventDefault();
  }
  
  const rootElement = rootRef.current;

  return (
    rootElement &&
    createPortal(
      <VscodeContextMenu {...props} className={className} ref={ref} data={data} onContextMenu={handleContextMenu} />,
      rootElement
    )
  );
}

export default ContextMenuPortal;
