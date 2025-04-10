import { VscodeCollapsible } from "@vscode-elements/react-elements";
import { NetworkLog } from "../hooks/useNetworkTracker";

interface HeadersTabProps {
  networkLog: NetworkLog;
}

interface SectionProps {
  data: Record<string, string> | undefined;
}

function Section({ data }: SectionProps) {
  return (
    <table className="section-content">
      {data &&
        Object.entries(data).map(([key, value]) => (
          <tr key={key} className="section-row">
            <td>{key}:</td>
            <td> {String(value)}</td>
          </tr>
        ))}
    </table>
  );
}

const HeadersTab = ({ networkLog }: HeadersTabProps) => {
  return (
    <>
      <VscodeCollapsible title="Request Headers">
        <Section data={networkLog.request?.headers} />
      </VscodeCollapsible>
      <VscodeCollapsible title="Response Headers" open>
        <Section data={networkLog.response?.headers} />
      </VscodeCollapsible>
    </>
  );
};

export default HeadersTab;
