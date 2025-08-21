import { useState, useMemo, useEffect } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import "./Preview.css";
import "./SendFilesOverlay.css";
import { useProject } from "../providers/ProjectProvider";

const RETAIN_SUCCESS_SCREEN = 1000; // 1 second

// Important! You need to hold shift to drag files onto the panel
// VSCode displays a "Hold shift to drop into editor" message when Preview is in the Editor Tab
// but it doesn't show this when Preview is in the Side Panel
export function SendFilesOverlay() {
  const { project } = useProject();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  // Hide overlay after success animation
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setIsSuccess(false);
        setIsVisible(false);
        setFileCount(0);
      }, RETAIN_SUCCESS_SCREEN);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

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
          setFileCount(files.length);

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

          Promise.all(filePromises)
            .then(() => {
              setIsLoading(false);
              setIsSuccess(true);
            })
            .catch(() => {
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
          if (!isLoading && !isSuccess) {
            setIsVisible(false);
          }
        },
      }) as const,
    [project, setIsVisible, isLoading, isSuccess]
  );

  return (
    <div
      {...dragHandlers}
      className={`phone-screen send-files-overlay ${isVisible ? "visible" : "hidden"} ${isSuccess ? "success" : ""}`}>
      <div className="send-files-overlay-container">
        <div className={`send-files-overlay-content ${!isLoading ? "breathe" : ""}`}>
          <div className="send-files-icon">
            {isLoading ? (
              <VscodeProgressRing />
            ) : isSuccess ? (
              <div className="success-icon-container">
                <span className="codicon codicon-check success-checkmark"></span>
              </div>
            ) : (
              <span className="codicon codicon-keyboard-tab rotate"></span>
            )}
          </div>
          <p>
            {isLoading
              ? "Sending files..."
              : isSuccess
                ? `${fileCount} file${fileCount !== 1 ? "s" : ""} sent successfully!`
                : "Drop files here"}
          </p>
        </div>
      </div>
    </div>
  );
}
