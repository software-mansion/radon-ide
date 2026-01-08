import { useEffect } from "react";
import "./ScreenshotCopiedToClipboardBox.css";
import "./DimensionsBox.css";

type ScreenshotCopiedToClipboardBoxProps = {
  isOpen: boolean;
  onClose: () => void;
};

function ScreenshotCopiedToClipboardBox({ isOpen, onClose }: ScreenshotCopiedToClipboardBoxProps) {
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      timer = setTimeout(() => {
        onClose();
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  return (
    <div className={`dimensions-box screenshot-copied-to-clipboard-box ${isOpen ? "open" : ""}`}>
      Copied to clipboard
    </div>
  );
}

export default ScreenshotCopiedToClipboardBox;
