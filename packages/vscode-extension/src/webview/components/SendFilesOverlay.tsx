import { useState } from "react";
import "./Preview.css";
import "./SendFilesOverlay.css";
import { useProject } from "../providers/ProjectProvider";

export function SendFilesOverlay() {
  const { project } = useProject();
  const [isVisible, setIsVisible] = useState(false);

  const dragHandlers = {
    onDrop: (ev: React.DragEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const files = ev.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        file.arrayBuffer().then((buf) => {
          project.sendFileToDevice({
            fileName: file.name,
            data: buf,
          });
        });
      }
      setIsVisible(false);
    },
    onDragOver: (ev: React.DragEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
    },
    onDragEnter: (ev: React.DragEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      setIsVisible(true);
    },
    onDragLeave: (ev: React.DragEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      // FIXME: gets incorrectly triggered immediately, why??
      // setIsVisible(false);
    },
  } as const;

  return (
    <div
      {...dragHandlers}
      className={`phone-screen send-files-overlay ${isVisible ? "visible" : "hidden"}`}>
      <div className="send-files-overlay-container">
        <div className="send-files-overlay-content">
          <div className="send-files-icon">
            <span className="codicon codicon-keyboard-tab"></span>
          </div>
          <p>Drop files here</p>
        </div>
      </div>
    </div>
  );
}
