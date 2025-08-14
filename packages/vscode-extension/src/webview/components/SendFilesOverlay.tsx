import "./Preview.css";
import "./SendFilesOverlay.css";

export function SendFilesOverlay() {
  return (
    <div className="phone-sized send-files-overlay">
      <span className="codicon codicon-chevron-up chevron chevron-left-up" />
      <span className="codicon codicon-chevron-up chevron chevron-left-down" />
      <span className="codicon codicon-chevron-up chevron chevron-right-up" />
      <span className="codicon codicon-chevron-up chevron chevron-right-down" />
      <p>Drop files here</p>
    </div>
  );
}
