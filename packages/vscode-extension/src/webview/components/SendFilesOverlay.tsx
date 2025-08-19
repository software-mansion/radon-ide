import { useState, useMemo, useEffect, useCallback } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import "./Preview.css";
import "./SendFilesOverlay.css";
import { use$ } from "@legendapp/state/react";
import { useProject } from "../providers/ProjectProvider";
import classNames from "classnames";
import { useStore } from "../providers/storeProvider";

const RETAIN_SUCCESS_SCREEN = 1000; // ms
const RETAIN_ERROR_SCREEN = 3000; // ms

// Important! You need to hold shift to drag files onto the panel
// VSCode displays a "Hold shift to drop into editor" message when Preview is in the Editor Tab
// but it doesn't show this when Preview is in the Side Panel
export function SendFilesOverlay() {
  const { project } = useProject();
  const store$ = useStore();
  const sendingFiles = use$(store$.projectState.sendingFiles);
  const [isVisible, setIsVisible] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const fileCount = sendingFiles.length;
  const isLoading = fileCount > 0;
  const [errorMessage, setErrorMessage] = useState("error");

  const resetOverlayState = useCallback(() => {
    setIsSuccess(false);
    setIsError(false);
    setIsVisible(false);
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
        onDrop: async (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          const files = ev.dataTransfer.files;

          try {
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

            await Promise.all(filePromises);
            setIsSuccess(true);
          } catch (error) {
            setIsError(true);
            // Set a user-friendly error message
            if (error instanceof Error && error.message) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage("Failed to send files. Please try again.");
            }
            console.error("File sending failed:", error);
          }
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
      className={classNames("phone-screen send-files-overlay", {
        visible: isVisible,
        hidden: !isVisible,
        success: isSuccess,
        error: isError,
      })}>
      <div className="send-files-overlay-container">
        <div className={classNames("send-files-overlay-content", { breathe: !isLoading })}>
          <div className="send-files-icon">{icon}</div>
          <p>{message}</p>
        </div>
      </div>
    </div>
  );
}
