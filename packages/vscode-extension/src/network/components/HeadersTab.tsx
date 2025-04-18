import "./HeadersTab.css";
import { VscodeCollapsible } from "@vscode-elements/react-elements";
import { NetworkLog } from "../hooks/useNetworkTracker";

interface HeadersTabProps {
  networkLog: NetworkLog;
}

interface SectionProps {
  data: Record<string, any> | undefined;
}

function formatHeaders(headersObj: Record<string, any> | undefined) {
  if (!headersObj) {
    return undefined;
  }

  // sort object by keys and capitalize keys
  const sortedObj = Object.entries(headersObj)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .reduce(
      (acc, [key, value]) => {
        // Capitalize the first letter of each word in the key
        const capitalizedKey = key
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("-");

        acc[capitalizedKey] = value;
        return acc;
      },
      {} as Record<string, any>
    );

  return sortedObj;
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
  const general = {
    "Request URL": networkLog.request?.url,
    "Request Method": networkLog.request?.method,
    "Status Code": networkLog.response?.status,
  };

  const sortedRequestHeaders = formatHeaders(networkLog.request?.headers);
  const sortedResponseHeaders = formatHeaders(networkLog.response?.headers);

  return (
    <>
      <VscodeCollapsible title="General" open>
        <Section data={general} />
      </VscodeCollapsible>
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
