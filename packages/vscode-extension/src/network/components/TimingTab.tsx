import "./TimingTab.css";
import { NetworkLog } from "../hooks/useNetworkTracker";

interface TimingTabProps {
  networkLog: NetworkLog;
}

const TimingTab = ({ networkLog }: TimingTabProps) => {
  const totalTime = networkLog.timeline.durationMs || 0;
  const ttfb = networkLog.timeline.ttfb || 0;

  const ttfbPercent = (ttfb / totalTime) * 100;
  const responseLoadingPercent = ((totalTime - ttfb) / totalTime) * 100;

  return (
    <>
      <div className="timing-bar">
        <div className="bar request-sent-bar" style={{ width: `${ttfbPercent}%` }} />
        <div className="bar response-receive-bar" style={{ width: `${responseLoadingPercent}%` }} />
      </div>

      <table className="timing-section">
        <tr>
          <td>Waiting (TTFB):</td>
          <td>{ttfb} ms</td>
        </tr>
        <tr>
          <td>Downloading response:</td>
          <td>{totalTime - ttfb} ms</td>{" "}
        </tr>
        <tr>
          <td>Total:</td>
          <td> {totalTime} ms</td>
        </tr>
      </table>
    </>
  );
};

export default TimingTab;
