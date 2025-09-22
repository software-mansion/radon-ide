import { useEffect } from "react";
import { VscodeTable } from "@vscode-elements/react-elements";
import { VscodeTable as VscodeTableElement } from "@vscode-elements/elements/dist/vscode-table/vscode-table.js";

interface VscodeTableInternalFixElement {
  _resizeTableBody: () => void;
  _assignedHeaderElements: HTMLElement[];
  _assignedBodyElements: HTMLElement[];
  _scrollableElement: HTMLElement;
  getBoundingClientRect: () => DOMRect;
}

interface VscodeTableInternalFixProps extends React.ComponentProps<typeof VscodeTable> {
  ref: React.RefObject<VscodeTableElement | null>;
  children?: React.ReactNode;
}

/**
 * VscodeTableInternalFix - A wrapper around VscodeTable that applies a fix for table body scroll behaviour.
 *
 * The component overwrites the original VscodeTable _resizeTableBody method implementation
 * to properly handle table body scrolling. It includes runtime checks to ensure compatibility
 * with the internal VscodeTable API.
 *
 * Usage of this component may be dropped when the fix is applied in the library.
 */
export default function VscodeTableInternalFix({
  children,
  ref,
  ...props
}: VscodeTableInternalFixProps) {
  useEffect(() => {
    const table = ref.current as unknown as VscodeTableInternalFixElement;
    if (!table) {
      return;
    }

    // Runtime checks to ensure the VscodeTable API is available
    const hasRequiredMethods =
      typeof table._resizeTableBody === "function" && 
      typeof table.getBoundingClientRect === "function" &&
      table._assignedHeaderElements !== undefined &&
      table._assignedBodyElements !== undefined &&
      table._scrollableElement !== undefined;

    if (!hasRequiredMethods) {
      console.warn(
        "VscodeTableInternal: VscodeTable internal API has changed or is not available. Fallback to the original implementation."
      );
      return;
    }

    const original_resizeTableBody = table._resizeTableBody;

    // Overwrite the _resizeTableBody method to fix issues with scrollbar not appearing
    // Original implementation: https://github.com/vscode-elements/elements/blob/main/src/vscode-table/vscode-table.ts
    table._resizeTableBody = () => {
        let headerHeight = 0;
        let tbodyHeight = 0;
        const tableHeight = table.getBoundingClientRect().height;
        if (table._assignedHeaderElements && table._assignedHeaderElements.length) {
            headerHeight =
                table._assignedHeaderElements[0].getBoundingClientRect().height;
        }
        if (table._assignedBodyElements && table._assignedBodyElements.length) {
            tbodyHeight =
                table._assignedBodyElements[0].getBoundingClientRect().height;
        }
        // Original code - tbodyHeight - headerHeight - tableHeight; 
        // its always the sign isnt it?
        const overflownContentHeight = tbodyHeight + headerHeight - tableHeight;
        table._scrollableElement.style.height =
            overflownContentHeight > 0 ? `${tableHeight - headerHeight}px` : 'auto';
    }

    // restore original method if needed
    return () => {
      if (table && original_resizeTableBody) {
        table._resizeTableBody = original_resizeTableBody;
      }
    };
  }, []);

  return (
    <VscodeTable ref={ref} {...props}>
      {children}
    </VscodeTable>
  );
}
