import "./TimingTab.css";
import { NetworkLog } from "../../types/networkLog";

interface TimingTabProps {
  networkLog: NetworkLog;
}

const TimingTab = ({ networkLog }: TimingTabProps) => {
  const totalTime = networkLog.timeline.durationMs || 0;
  const ttfb = networkLog.timeline.ttfb || 0;
  const downloadTime = networkLog.timeline.downloadTime || 0;

  const ttfbPercent = (ttfb / totalTime) * 100;
  const responseLoadingPercent = ((totalTime - ttfb) / totalTime) * 100;

  return (
    <div className="tab-padding">
      <div className="timing-bar">
        <div className="bar request-sent-bar" style={{ width: `${ttfbPercent}%` }} />
        <div className="bar response-receive-bar" style={{ width: `${responseLoadingPercent}%` }} />
      </div>

      <table className="timing-section">
        <tr>
          <td>Waiting (TTFB):</td>
          <td className="timing-value">{ttfb} ms</td>
        </tr>
        <tr>
          <td>Downloading response:</td>
          <td className="timing-value">{downloadTime} ms</td>{" "}
        </tr>
        <tr>
          <td>Total:</td>
          <td className="timing-value"> {totalTime} ms</td>
        </tr>
      </table>
    </div>
  );
};

export default TimingTab;
