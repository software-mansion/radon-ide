import "./Preview.css";
import "./SendFilesOverlay.css";

interface SendFilesOverlayProps {
  dragHandlers: {
    onDrop?: (ev: React.DragEvent) => void;
    onDragOver?: (ev: React.DragEvent) => void;
    onDragEnter?: (ev: React.DragEvent) => void;
    onDragLeave?: (ev: React.DragEvent) => void;
  };
}

export function SendFilesOverlay({ dragHandlers }: SendFilesOverlayProps) {
  return (
    <>
      <div className="phone-sized send-files-overlay-container" {...dragHandlers}>
        <div className="send-files-overlay-content">
          <div className="send-files-content-inner">
            <div className="send-files-icon">
              <span className="codicon codicon-keyboard-tab"></span>
            </div>
            <p>Drop files here</p>
          </div>
        </div>
      </div>
      <div className="phone-sized send-files-overlay" {...dragHandlers}></div>
    </>
  );
}
