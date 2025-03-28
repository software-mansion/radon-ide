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
    <div className="timing-container">
      <div className="timing-bar">
        <div className="bar request-sent-bar" style={{ width: `${ttfbPercent}%` }} />
        <div className="bar response-receive-bar" style={{ width: `${responseLoadingPercent}%` }} />
      </div>

      <div className="timing-section">
        <span>Waiting (TTFB): {ttfb} ms</span>
        <span>Downloading response: {totalTime - ttfb} ms</span>
        <span>Total: {totalTime} ms</span>
      </div>
    </div>
  );
};

export default TimingTab;
