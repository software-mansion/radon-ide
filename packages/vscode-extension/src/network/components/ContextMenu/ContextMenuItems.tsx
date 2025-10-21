import { capitalize } from "lodash";
import * as ContextMenu from "@radix-ui/react-context-menu";
import Tooltip from "../../../webview/components/shared/Tooltip";
import { getSortIcon } from "../NetworkRequestLog";
import { copyToClipboard } from "../../utils/clipboard";
import {
  getRequestDetails,
  getResponseDetails,
  getFormattedRequestBody,
  getRequestPayload,
  hasUrlParams,
  createCurlCommand,
  createFetchCommand,
  getUrl,
} from "../../utils/requestFormatters";
import { useNetwork } from "../../providers/NetworkProvider";
import { NetworkLog, NetworkLogColumn, NETWORK_LOG_COLUMNS } from "../../types/networkLog";
import { ResponseBodyData } from "../../types/network";
import { SortState } from "../../types/networkFilter";
export interface CopySubmenuProps {
  networkLog: NetworkLog | null;
  responseBodyData: ResponseBodyData | undefined;
}

export interface SortSubmenuProps {
  handleSort: (column: NetworkLogColumn) => void;
  sortState: SortState;
}

export interface FilterItemProps {
  onFocusFilter: () => void;
}

export interface CopySubmenuConfig {
  enabled: boolean;
}
export interface SortSubmenuConfig extends SortSubmenuProps {
  enabled: boolean;
}
export interface FilterItemConfig {
  enabled: boolean;
}

export interface OpenInEditorItemProps {
  networkLog: NetworkLog | null;
  responseBodyData: ResponseBodyData | undefined;
}

export interface OpenInEditorItemConfig {
  enabled: boolean;
}

export function CopySubmenu({ networkLog, responseBodyData }: CopySubmenuProps) {
  const parseAndCopy = async (parseLog: (networkLog: NetworkLog) => string | undefined) => {
    if (!networkLog) {
      return;
    }
    const clipboardText = parseLog(networkLog);
    await copyToClipboard(clipboardText);
  };

  const handleCopyCurl = () => parseAndCopy(createCurlCommand);

  const handleCopyFetch = () => parseAndCopy(createFetchCommand);

  const handleCopyUrl = () => parseAndCopy(getUrl);

  const handleCopyResponseJson = () => parseAndCopy(getResponseDetails);

  const handleCopyRequestJson = () => parseAndCopy(getRequestDetails);

  const handleCopyRequestPayload = () => parseAndCopy(getRequestPayload);

  const getResponseBodyAsJsonString = (_: NetworkLog) => {
    const responseBody = responseBodyData?.body;

    if (!networkLog?.response || !responseBody || typeof responseBody !== "string") {
      return "{}";
    }
    return getFormattedRequestBody(responseBody);
  };

  const handleCopyResponseBody = () => parseAndCopy(getResponseBodyAsJsonString);

  return (
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

          <ContextMenu.Item
            className="radix-context-menu-item"
            onSelect={handleCopyUrl}
            disabled={!networkLog}>
            <span className="codicon codicon-link"></span>
            Copy URL
          </ContextMenu.Item>

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
            disabled={!responseBodyData?.body || !networkLog?.response}>
            {/* Tooltip has to be nested in ContextMenu.Item, causes problems with
                  "instant" attribute behaviour otherwise */}
            <Tooltip
              instant={false}
              disabled={!responseBodyData?.wasTruncated}
              label={"Response body was truncated"}
              side="bottom">
              <>
                <span className="codicon codicon-file-text"></span>
                Copy Response Body
                {responseBodyData?.wasTruncated && <span className="codicon codicon-warning" />}
              </>
            </Tooltip>
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

export function OpenInEditorItem({ networkLog, responseBodyData }: OpenInEditorItemProps) {
  const { fetchAndOpenResponseInEditor } = useNetwork();

  const handleSelect = () =>
    networkLog &&
    fetchAndOpenResponseInEditor(networkLog, responseBodyData?.base64Encoded ?? false);

  return (
    <ContextMenu.Item
      className="radix-context-menu-item"
      disabled={!responseBodyData?.body || !networkLog?.response}
      onSelect={handleSelect}>
      <span className="codicon codicon-chrome-restore"></span>
      Open Response
    </ContextMenu.Item>
  );
}
