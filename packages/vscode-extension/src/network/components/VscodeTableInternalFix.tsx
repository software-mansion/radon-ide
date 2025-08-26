import { useEffect } from "react";
import { VscodeTable } from "@vscode-elements/react-elements";
import { VscodeTable as VscodeTableElement } from "@vscode-elements/elements/dist/vscode-table/vscode-table.js";

interface VscodeTableInternalFixElement {
  _resizeColumns: (resizeBodyCells?: boolean) => void;
  _getSashPositions: () => { sashPos: number; prevSashPos: number; nextSashPos: number };
  _headerCellsToResize: HTMLElement[];
  _cellsToResize: HTMLElement[];
}

interface VscodeTableInternalFixProps extends React.ComponentProps<typeof VscodeTable> {
  ref: React.RefObject<VscodeTableElement | null>;
  children?: React.ReactNode;
}

/**
 * VscodeTableInternalFix - A wrapper around VscodeTable that applies a fix for column resizing behavior.
 *
 * The component overwrites the original VscodeTable _resizeColumns method implementation
 * to properly handle column width updates. It includes runtime checks to ensure compatibility
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
      typeof table._resizeColumns === "function" && typeof table._getSashPositions === "function";

    if (!hasRequiredMethods) {
      console.warn(
        "VscodeTableInternal: VscodeTable internal API has changed or is not available. Fallback to the original implementation."
      );
      return;
    }

    const original_resizeColumns = table._resizeColumns;

    // Overwrite the _resizeColumns method to fix issues with resizing when no rows are present
    // Original implementation: https://github.com/vscode-elements/elements/blob/main/src/vscode-table/vscode-table.ts
    table._resizeColumns = (resizeBodyCells = true) => {
      try {
        const { sashPos, prevSashPos, nextSashPos } = table._getSashPositions();

        const prevColW = sashPos - prevSashPos;
        const nextColW = nextSashPos - sashPos;
        const prevColCss = `${prevColW}%`;
        const nextColCss = `${nextColW}%`;

        table._headerCellsToResize[0].style.width = prevColCss;

        if (table._headerCellsToResize[1]) {
          table._headerCellsToResize[1].style.width = nextColCss;
        }

        //add additional guard here to prevent error when table._cellsToResize[0] is undefined
        if (resizeBodyCells && table._cellsToResize[0]) {
          table._cellsToResize[0].style.width = prevColCss;

          if (table._cellsToResize[1]) {
            table._cellsToResize[1].style.width = nextColCss;
          }
        }
      } catch (error) {
        console.error("VscodeTableInternal: Error in _resizeColumns implementation:", error);
        // Fallback to original implementation on error
        original_resizeColumns?.call(table, resizeBodyCells);
      }
    };

    // restore original method if needed
    return () => {
      if (table && original_resizeColumns) {
        table._resizeColumns = original_resizeColumns;
      }
    };
  }, []);

  return (
    <VscodeTable ref={ref} {...props}>
      {children}
    </VscodeTable>
  );
}
