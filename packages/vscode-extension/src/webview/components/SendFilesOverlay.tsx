import "./Preview.css";
import "./SendFilesOverlay.css";

export function SendFilesOverlay() {
  return (
    <>
      <div className="phone-sized send-files-overlay-container">
        <div className="send-files-overlay-content">
          <div className="send-files-content-inner">
            <div className="send-files-icon">
              <span className="codicon codicon-keyboard-tab"></span>
            </div>
            <p>Drop files here</p>
          </div>
        </div>
      </div>
      <div className="phone-sized send-files-overlay"></div>
    </>
  );
}
