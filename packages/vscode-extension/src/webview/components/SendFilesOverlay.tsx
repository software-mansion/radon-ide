import { useState, useMemo, useEffect, useCallback } from "react";
import { VscodeProgressRing } from "@vscode-elements/react-elements";
import "./Preview.css";
import "./SendFilesOverlay.css";
import { use$ } from "@legendapp/state/react";
import classNames from "classnames";
import _ from "lodash";
import { useProject } from "../providers/ProjectProvider";
import { useSelectedDeviceSessionState } from "../hooks/selectedSession";

const RETAIN_SUCCESS_SCREEN_TIMEOUT = 1000; // ms
const RETAIN_ERROR_SCREEN_TIMEOUT = 5000; // ms

// Important! You need to hold shift to drag files onto the panel
// VSCode displays a "Hold shift to drop into editor" message when Preview is in the Editor Tab
// but it doesn't show this when Preview is in the Side Panel
export function SendFilesOverlay() {
  const { project } = useProject();
  const [isDragging, setIsDragging] = useState(false);
  const store$ = useSelectedDeviceSessionState();
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const sendingFiles = use$(store$?.fileTransfer.sendingFiles) ?? [];
  const erroredFiles = use$(store$?.fileTransfer.erroredFiles) ?? [];
  const sentFiles = use$(store$?.fileTransfer.sentFiles) ?? [];
  const isError = erroredFiles.length > 0;
  const isSuccess = sentFiles.length > 0;

  const inProgressCount = useMemo(
    () =>
      _.uniqBy([...droppedFiles, ...sendingFiles], (file) => {
        if (typeof file === "string") {
          return file;
        } else {
          return file.name;
        }
      }).length,
    [droppedFiles, sendingFiles]
  );
  const isLoading = inProgressCount > 0;

  const isVisible = isDragging || isLoading || isError || isSuccess;

  const resetOverlayState = useCallback(() => {
    store$.fileTransfer.erroredFiles.set([]);
    store$.fileTransfer.sentFiles.set([]);
  }, [store$]);

  // Hide overlay after success and error animations
  useEffect(() => {
    if (!isLoading && (erroredFiles.length > 0 || sentFiles.length > 0)) {
      const timer = setTimeout(
        resetOverlayState,
        isSuccess ? RETAIN_SUCCESS_SCREEN_TIMEOUT : RETAIN_ERROR_SCREEN_TIMEOUT
      );
      return () => clearTimeout(timer);
    }
  }, [isLoading, erroredFiles, sentFiles, resetOverlayState]);

  const sendFile = async (file: File) => {
    try {
      setDroppedFiles((files) => [...files, file]);
      let buf: ArrayBuffer;
      try {
        buf = await file.arrayBuffer();
      } catch (e) {
        // NOTE: `arrayBuffer()` may fail when the file cannot be read.
        // Since we don't send anything to the extension in that case, we need to handle it here.
        console.error("Error when reading file:", file.name, e);
        store$.fileTransfer.erroredFiles.set((prev) => [
          ...(prev ?? []),
          { fileName: file.name, errorMessage: "Could not read the file." },
        ]);
        return;
      }
      await project.sendFileToDevice({
        fileName: file.name,
        data: buf,
      });
    } catch {
      // NOTE: ignore errors from `sendFileToDevice`, they should be logged by the extension
    } finally {
      setDroppedFiles((files) => {
        const index = files.indexOf(file);
        if (index > -1) {
          return files.toSpliced(index, 1);
        }
        return files;
      });
    }
  };

  const dragHandlers = useMemo(
    () =>
      ({
        onDragEnter: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
        },
        onDrop: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          setIsDragging(false);
          if (!ev.shiftKey) {
            return;
          }
          const files = ev.dataTransfer.files;

          for (let i = 0; i < files.length; i++) {
            sendFile(files[i]);
          }
        },
        onDragOver: (ev: React.DragEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          setIsDragging(ev.shiftKey);
        },
        onDragLeave: (ev: React.DragEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          setIsDragging(false);
        },
      }) as const,
    [project, isLoading, isSuccess, isError]
  );

  const getOverlayContent = () => {
    if (isLoading) {
      const fileCount = inProgressCount;
      return {
        icon: <VscodeProgressRing />,
        message: `Sending ${fileCount} file${fileCount !== 1 ? "s" : ""}...`,
      };
    }

    if (isError) {
      return {
        icon: (
          <div className="error-icon-container">
            <span className="codicon codicon-error error-icon"></span>
          </div>
        ),
        message:
          erroredFiles[0].errorMessage || "Failed to send some files. Check logs for details.",
      };
    }

    if (isSuccess) {
      const fileCount = sentFiles.length;
      return {
        icon: (
          <div className="success-icon-container">
            <span className="codicon codicon-check success-checkmark"></span>
          </div>
        ),
        message: `${fileCount} file${fileCount !== 1 ? "s" : ""} sent successfully!`,
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
