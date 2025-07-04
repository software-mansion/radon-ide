import "./RadonConnectView.css";

export default function RadonConnectView({ connected }: { connected: boolean }) {
  const className = connected ? "connected" : "";
  return (
    <div className="radon-connect-container">
      <h2 className="radon-connect-text">Radon Connect</h2>
      <span className={`codicon codicon-debug-disconnect radon-connect-icon ${className}`} />
      <h3 className="radon-connect-text">
        {connected ? "Connected to metro" : "Start metro / expo on your computer"}
      </h3>
      <h3 className="radon-connect-text">You can close this panel now</h3>
    </div>
  );
}
