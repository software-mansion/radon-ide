import { useState, useMemo, useEffect, useCallback } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import "./Preview.css";
import "./SendFilesOverlay.css";
import { useProject } from "../providers/ProjectProvider";

const RETAIN_SUCCESS_SCREEN = 1000; // ms
const RETAIN_ERROR_SCREEN = 3000; // ms

// Important! You need to hold shift to drag files onto the panel
// VSCode displays a "Hold shift to drop into editor" message when Preview is in the Editor Tab
// but it doesn't show this when Preview is in the Side Panel
export function SendFilesOverlay() {
  const { project } = useProject();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const resetOverlayState = useCallback(() => {
    setIsSuccess(false);
    setIsError(false);
    setIsVisible(false);
    setFileCount(0);
    setErrorMessage("");
  }, []);

  // Hide overlay after success and error animations
  useEffect(() => {
    if (isSuccess || isError) {
      const timer = setTimeout(
        resetOverlayState,
        isSuccess ? RETAIN_SUCCESS_SCREEN : RETAIN_ERROR_SCREEN
      );
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isError, resetOverlayState]);

  const dragHandlers = useMemo(
    () =>
      ({
        onDragEnter: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (isError) {
            setIsError(false);
            setErrorMessage("");
          }
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
            .catch((error) => {
              setIsLoading(false);
              setIsError(true);
              // Set a user-friendly error message
              if (error?.message) {
                setErrorMessage(error.message);
              } else {
                setErrorMessage("Failed to send files. Please try again.");
              }
              console.error("File sending failed:", error);
            });
        },
        onDragOver: (ev: React.DragEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        },
        onDragLeave: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!isLoading && !isSuccess && !isError) {
            setIsVisible(false);
          }
        },
      }) as const,
    [project, setIsVisible, isLoading, isSuccess, isError]
  );

  const getOverlayContent = () => {
    if (isLoading) {
      return {
        icon: <VscodeProgressRing />,
        message: "Sending files...",
      };
    }

    if (isSuccess) {
      return {
        icon: (
          <div className="success-icon-container">
            <span className="codicon codicon-check success-checkmark"></span>
          </div>
        ),
        message: `${fileCount} file${fileCount !== 1 ? "s" : ""} sent successfully!`,
      };
    }

    if (isError) {
      return {
        icon: (
          <div className="error-icon-container">
            <span className="codicon codicon-error error-icon"></span>
          </div>
        ),
        message: errorMessage,
      };
    }

    return {
      icon: <span className="codicon codicon-keyboard-tab rotate"></span>,
      message: "Drop files here",
    };
  };

  const { icon, message } = getOverlayContent();

  return (
    <div
      {...dragHandlers}
      className={`phone-screen send-files-overlay ${isVisible ? "visible" : "hidden"} ${isSuccess ? "success" : ""} ${isError ? "error" : ""}`}>
      <div className="send-files-overlay-container">
        <div className={`send-files-overlay-content ${!isLoading ? "breathe" : ""}`}>
          <div className="send-files-icon">{icon}</div>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}
