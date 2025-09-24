import { useEffect } from "react";
import { VscodeTable } from "@vscode-elements/react-elements";
import { VscodeTable as VscodeTableElement } from "@vscode-elements/elements/dist/vscode-table/vscode-table.js";

interface VscodeTableInternalFixElement {
  // Scroll bugfix
  _resizeTableBody: () => void;
  _assignedHeaderElements: HTMLElement[];
  _assignedBodyElements: HTMLElement[];
  _scrollableElement: HTMLElement;
  getBoundingClientRect: () => DOMRect;

  // Column bugfix
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
 * VscodeTableInternalFix - A wrapper around VscodeTable that applies a fix for table body scroll and column resizing behaviour.
 *
 * The component overwrites the original VscodeTable _resizeTableBody and _resizeColumns methods implementation
 * to properly handle table body scrolling and column width updates. Without the fix, scrollbar does not appear even when
 * the content overflows the table body and column resizing exhibits unwanted behaviour when there are no logs.
 *
 * The component includes runtime checks to ensure compatibility with the internal VscodeTable API.
 *
 * Usage of this component may be dropped when the fix is applied in the library (fix for columns is available, but new version causes issues with
 * scroll in virtualized table, so this stays for now).
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
    const hasRequiredScrollMethods =
      typeof table._resizeTableBody === "function" &&
      typeof table.getBoundingClientRect === "function" &&
      table._assignedHeaderElements !== undefined &&
      table._assignedBodyElements !== undefined &&
      table._scrollableElement !== undefined;

    const hasRequiredColumnMethods =
      typeof table._resizeColumns === "function" && typeof table._getSashPositions === "function";

    if (!hasRequiredScrollMethods || !hasRequiredColumnMethods) {
      console.warn(
        "VscodeTableInternal: VscodeTable internal API has changed or is not available. Fallback to the original implementation."
      );
      return;
    }

    const original_resizeTableBody = table._resizeTableBody;
    const original_resizeColumns = table._resizeColumns;

    // Overwrite the _resizeTableBody method to fix issues with scrollbar not appearing, even though
    // the content overflows the table body.
    // Original implementation: https://github.com/vscode-elements/elements/blob/main/src/vscode-table/vscode-table.ts
    table._resizeTableBody = () => {
      let headerHeight = 0;
      let tbodyHeight = 0;
      const tableHeight = table.getBoundingClientRect().height;
      if (table._assignedHeaderElements && table._assignedHeaderElements.length) {
        headerHeight = table._assignedHeaderElements[0].getBoundingClientRect().height;
      }
      if (table._assignedBodyElements && table._assignedBodyElements.length) {
        tbodyHeight = table._assignedBodyElements[0].getBoundingClientRect().height;
      }
      // Original code - tbodyHeight - headerHeight - tableHeight;
      // its always the sign isnt it?
      const overflownContentHeight = tbodyHeight + headerHeight - tableHeight;
      table._scrollableElement.style.height =
        overflownContentHeight > 0 ? `${tableHeight - headerHeight}px` : "auto";
    };

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
      if (!table) {
        return;
      }
      if (original_resizeTableBody) {
        table._resizeTableBody = original_resizeTableBody;
      }
      if (original_resizeColumns) {
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
