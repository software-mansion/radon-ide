import { useState, useMemo } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import "./Preview.css";
import "./SendFilesOverlay.css";
import { useProject } from "../providers/ProjectProvider";

// Important! You need to hold shift to drag files onto the panel
// VSCode displays a "Hold shift to drop into editor" message when Preview is in the Editor Tab
// but it doesn't show this when Preview is in the Side Panel
export function SendFilesOverlay() {
  const { project } = useProject();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const dragHandlers = useMemo(
    () =>
      ({
        onDragEnter: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          setIsVisible(true);
        },
        onDrop: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          setIsLoading(true);
          const files = ev.dataTransfer.files;

          const filePromises = [];
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const promise = file.arrayBuffer().then((buf) => {
              return project.sendFileToDevice({
                fileName: file.name,
                data: buf,
              });
            });
            filePromises.push(promise);
          }

          Promise.all(filePromises).finally(() => {
            setIsLoading(false);
            setIsVisible(false);
          });
        },
        onDragOver: (ev: React.DragEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        },
        onDragLeave: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!isLoading) {
            setIsVisible(false);
          }
        },
      }) as const,
    [project, setIsVisible, isLoading]
  );

  return (
    <div
      {...dragHandlers}
      className={`phone-screen send-files-overlay ${isVisible ? "visible" : "hidden"}`}>
      <div className="send-files-overlay-container">
        <div className="send-files-overlay-content">
          <div className="send-files-icon">
            {isLoading ? (
              <VscodeProgressRing />
            ) : (
              <span className="codicon codicon-keyboard-tab"></span>
            )}
          </div>
          <p>{isLoading ? "Sending files..." : "Drop files here"}</p>
        </div>
      </div>
    </div>
  );
}
