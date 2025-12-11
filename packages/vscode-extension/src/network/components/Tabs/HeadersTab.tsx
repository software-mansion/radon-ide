import "./HeadersTab.css";
import { VscodeCollapsible } from "@vscode-elements/react-elements";
import { NetworkLog } from "../../types/networkLog";
import { PropsWithDataTest } from "../../../common/types";

interface HeadersTabProps {
  networkLog: NetworkLog;
}

interface SectionProps {
  data: Record<string, string | number | undefined> | undefined;
}

interface StatusDotProps {
  status: HeaderValue;
}

type HeaderValue = string | number | undefined;

type StatusColor = "gray" | "green" | "yellow" | "red";

const STATUS_CODE_KEY = "Status Code";

function formatHeaders(headersObj: Record<string, HeaderValue> | undefined) {
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
      {} as Record<string, HeaderValue>
    );

  return sortedObj;
}

function getStatusColor(status: HeaderValue): StatusColor {
  const numericStatus = Number(status);
  if (!numericStatus || isNaN(numericStatus)) {
    return "gray";
  }

  if (numericStatus >= 100 && numericStatus <= 299) {
    return "green";
  }
  if (numericStatus >= 300 && numericStatus <= 399) {
    return "yellow";
  }
  if (numericStatus >= 400 && numericStatus <= 599) {
    return "red";
  }

  return "gray";
}

function StatusDot({ status }: StatusDotProps) {
  return <span className={`status-dot ${getStatusColor(status)}`} />;
}

function Section({ data, dataTest }: PropsWithDataTest<SectionProps>) {
  return (
    <table>
      {data &&
        Object.entries(data).map(([key, value]) => (
          <tr key={key}>
            <td className="network-log-request-header">{key}:</td>
            <td
              className="network-log-request-header-value"
              data-testid={`network-log-${dataTest}-${key}-value`}>
              {key === STATUS_CODE_KEY && <StatusDot status={value} />}
              {String(value)}
            </td>
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
      <VscodeCollapsible title="General" data-testid="general-collapsible" open>
        <Section data={general} dataTest="general" />
      </VscodeCollapsible>
      <VscodeCollapsible title="Request Headers" data-testid="request-headers-collapsible" open>
        <Section data={sortedRequestHeaders} dataTest="request-headers" />
      </VscodeCollapsible>
      <VscodeCollapsible title="Response Headers" data-testid="response-headers-collapsible" open>
        <Section data={sortedResponseHeaders} dataTest="response-headers" />
      </VscodeCollapsible>
    </>
  );
};

export default HeadersTab;
