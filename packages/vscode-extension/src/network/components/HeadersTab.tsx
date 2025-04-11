import "./HeadersTab.css";
import { VscodeCollapsible } from "@vscode-elements/react-elements";
import { NetworkLog } from "../hooks/useNetworkTracker";

interface HeadersTabProps {
  networkLog: NetworkLog;
}

interface SectionProps {
  data: Record<string, string> | undefined;
}

function sortHeaders(headers: Record<string, string> | undefined) {
  if (!headers) {
    return undefined;
  }
  const sortedHeaders = Object.entries(headers)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
  return sortedHeaders;
}

function Section({ data }: SectionProps) {
  return (
    <table>
      {data &&
        Object.entries(data).map(([key, value]) => (
          <tr key={key}>
            <td className="network-log-request-header">{key}:</td>
            <td> {String(value)}</td>
          </tr>
        ))}
    </table>
  );
}

const HeadersTab = ({ networkLog }: HeadersTabProps) => {
  const sortedRequestHeaders = sortHeaders(networkLog.request?.headers);
  const sortedResponseHeaders = sortHeaders(networkLog.response?.headers);
  return (
    <>
      <VscodeCollapsible title="Request Headers">
        <Section data={sortedRequestHeaders} />
      </VscodeCollapsible>
      <VscodeCollapsible title="Response Headers" open>
        <Section data={sortedResponseHeaders} />
      </VscodeCollapsible>
    </>
  );
};

export default HeadersTab;
