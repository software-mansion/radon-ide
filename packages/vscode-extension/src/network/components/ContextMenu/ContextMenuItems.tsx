import { useState } from "react";
import { capitalize } from "lodash";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { NetworkLog } from "../../hooks/useNetworkTracker";
import { NetworkLogColumn, SortState } from "../../types/network";
import { getSortIcon } from "../NetworkRequestLog";
import { NETWORK_LOG_COLUMNS } from "../../utils/networkLogUtils";
import { generateCurlCommand, generateFetchCommand, getUrl } from "../../utils/contextMenuUtils";
import { copyToClipboard } from "../../utils/sharedUtils";
import {
  getRequestJson,
  getResponseJson,
  formatJSONBody,
  getRequestPayload,
  hasUrlParams,
} from "../../utils/requestFormatUtils";
import { useNetwork } from "../../providers/NetworkProvider";

export interface CopySubmenuProps {
  networkLog: NetworkLog | null;
}

export interface SortSubmenuProps {
  handleSort: (column: NetworkLogColumn) => void;
  sortState: SortState;
}

export interface FilterItemProps {
  onFocusFilter: () => void;
}

export interface CopySubmenuConfig extends CopySubmenuProps {
  enabled: boolean;
}
export interface SortSubmenuConfig extends SortSubmenuProps {
  enabled: boolean;
}
export interface FilterItemConfig {
  enabled: boolean;
}

export function CopySubmenu({ networkLog }: CopySubmenuProps) {
  const [responseBody, setResponseBody] = useState<string | unknown>(null);
  const { getResponseBody } = useNetwork();

  const handleOpenChange = async (open: boolean) => {
    // In order to prevent fetching responseBody as soon as the request log is rendered
    // (which has memory implications on the backend), we wait until the user
    // opens the menu for the first time
    if (!open || !networkLog) {
      return;
    }
    // Prefetch response body for copy menu when context menu opens
    const body = await getResponseBody(networkLog);
    setResponseBody(body);
  };

  const handleCopyCurl = async () => {
    if (!networkLog) {
      return;
    }
    const curlCommand = generateCurlCommand(networkLog);
    await copyToClipboard(curlCommand);
  };

  const handleCopyFetch = async () => {
    if (!networkLog) {
      return;
    }
    const fetchCommand = generateFetchCommand(networkLog);
    await copyToClipboard(fetchCommand);
  };

  const handleCopyUrl = async () => {
    if (!networkLog) {
      return;
    }
    const url = getUrl(networkLog);
    await copyToClipboard(url);
  };

  const handleCopyResponseJson = async () => {
    if (!networkLog) {
      return;
    }
    const responseJson = getResponseJson(networkLog);
    await copyToClipboard(responseJson);
  };

  const handleCopyRequestJson = async () => {
    if (!networkLog) {
      return;
    }
    const requestJson = getRequestJson(networkLog);
    await copyToClipboard(requestJson);
  };

  const handleCopyResponseBody = async () => {
    if (!networkLog) {
      return;
    }

    if (responseBody === null || typeof responseBody !== "string") {
      await copyToClipboard("{}");
    } else {
      await copyToClipboard(formatJSONBody(responseBody));
    }
  };

  const handleCopyRequestPayload = async () => {
    if (!networkLog) {
      return;
    }
    const requestPayload = getRequestPayload(networkLog);
    await copyToClipboard(requestPayload);
  };

  return (
    <ContextMenu.Sub onOpenChange={handleOpenChange}>
      <ContextMenu.SubTrigger className="radix-context-menu-item radix-context-menu-subtrigger">
        <span className="codicon codicon-copy"></span>
        Copy
        <span className="radix-context-menu-arrow">
          <span className="codicon codicon-chevron-right"></span>
        </span>
      </ContextMenu.SubTrigger>

      <ContextMenu.Portal>
        <ContextMenu.SubContent
          className="radix-context-menu-content radix-context-menu-subcontent"
          sideOffset={2}
          alignOffset={-5}>
          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyCurl}
            disabled={!networkLog}>
            <span className="codicon codicon-terminal"></span>
            Copy as cURL
          </ContextMenu.Item>

          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyFetch}
            disabled={!networkLog}>
            <span className="codicon codicon-code"></span>
            Copy as fetch
          </ContextMenu.Item>

          <ContextMenu.Separator className="radix-context-menu-separator" />

          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyUrl}
            disabled={!networkLog}>
            <span className="codicon codicon-link"></span>
            Copy URL
          </ContextMenu.Item>

          <ContextMenu.Separator className="radix-context-menu-separator" />

          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyRequestJson}
            disabled={!networkLog || !networkLog.request}>
            <span className="codicon codicon-json"></span>
            Copy Request JSON
          </ContextMenu.Item>

          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyRequestPayload}
            disabled={!networkLog?.request?.postData && !hasUrlParams(networkLog)}>
            <span className="codicon codicon-file-text"></span>
            Copy Request Payload
          </ContextMenu.Item>

          <ContextMenu.Separator className="radix-context-menu-separator" />

          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyResponseJson}
            disabled={!networkLog || !networkLog.response}>
            <span className="codicon codicon-json"></span>
            Copy Response JSON
          </ContextMenu.Item>

          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyResponseBody}
            disabled={!networkLog || !networkLog.response}>
            <span className="codicon codicon-file-text"></span>
            Copy Response Body
          </ContextMenu.Item>
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
}

export function SortSubmenu({ handleSort, sortState }: SortSubmenuProps) {
  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger className="radix-context-menu-item radix-context-menu-subtrigger">
        <span className="codicon codicon-list-ordered"></span>
        Sort
        <span className="radix-context-menu-arrow">
          <span className="codicon codicon-chevron-right"></span>
        </span>
      </ContextMenu.SubTrigger>

      <ContextMenu.Portal>
        <ContextMenu.SubContent
          className="radix-context-menu-content radix-context-menu-subcontent"
          sideOffset={2}
          alignOffset={-5}>
          {NETWORK_LOG_COLUMNS.map((column) => (
            <ContextMenu.Item
              key={column}
              onSelect={() => handleSort(column)}
              className="radix-context-menu-item ">
              {capitalize(column)}
              <span className="radix-context-sort-arrow">
                <span className={`codicon ${getSortIcon(column, sortState)}`}></span>
              </span>
            </ContextMenu.Item>
          ))}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
}

export function FilterItem({ onFocusFilter }: FilterItemProps) {
  return (
    <ContextMenu.Item className="radix-context-menu-item" onSelect={onFocusFilter}>
      <span className="codicon codicon-filter"></span>
      Filter
    </ContextMenu.Item>
  );
}
