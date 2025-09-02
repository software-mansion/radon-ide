import * as ContextMenu from "@radix-ui/react-context-menu";
import { capitalize } from "lodash";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog } from "../hooks/useNetworkTracker";
import { NetworkLogColumn } from "../types/network";
import { SortState } from "../types/network";
import { getSortIcon } from "./NetworkRequestLog";
import { NETWORK_LOG_COLUMNS } from "../utils/networkLogUtils";
import {
  generateCurlCommand,
  generateFetchCommand,
  getUrl,
  copyToClipboard,
} from "../utils/contextMenuUtils";
import {
  getRequestJson,
  getResponseJson,
  formatJSONBody,
  getRequestPayload,
} from "../utils/requestFormatUtils";
import "./NetworkLogContextMenu.css";

interface NetworkLogContextMenuProps {
  children: React.ReactNode;
  networkLog: NetworkLog | null;
  onSort: (column: NetworkLogColumn) => void;
  sortState: SortState;
}

function NetworkLogContextMenu({
  children,
  networkLog,
  onSort,
  sortState,
}: NetworkLogContextMenuProps) {
  const { getResponseBody } = useNetwork();

  // Context menu handlers
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
    const responseBody = await getResponseBody(networkLog);
    const formattedBody = formatJSONBody(responseBody);
    await copyToClipboard(formattedBody);
  };

  const handleCopyRequestPayload = async () => {
    if (!networkLog) {
      return;
    }
    const requestPayload = getRequestPayload(networkLog);
    await copyToClipboard(requestPayload);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="radix-context-menu-content"
          onContextMenu={(e) => e.preventDefault()}>
          <ContextMenu.Sub>
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
                  disabled={!networkLog || !networkLog.request?.postData}>
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

          <ContextMenu.Separator className="radix-context-menu-separator" />

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
                  <ContextMenu.Sub key={column}>
                    <ContextMenu.Item
                      onSelect={() => onSort(column)}
                      className="radix-context-menu-item ">
                      {capitalize(column)}
                      <span className="radix-context-menu-arrow">
                        <span className={`codicon ${getSortIcon(column, sortState)}`}></span>
                      </span>
                    </ContextMenu.Item>
                  </ContextMenu.Sub>
                ))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export default NetworkLogContextMenu;
