import React from "react";
import * as Dialog from "@radix-ui/react-dialog";

import "./Modal.css";
import classNames from "classnames";
import IconButton from "./IconButton";

interface ModalProps {
  title?: string;
  component: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  headerShown?: boolean;
  isFullScreen?: boolean;
}

export default function Modal({
  title,
  component,
  isOpen,
  onClose,
  headerShown,
  isFullScreen,
}: ModalProps) {
  if (component === null) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" onClick={onClose} />
        <Dialog.Content
          className={classNames("modal-content", isFullScreen && "modal-content-fullscreen")}
          onEscapeKeyDown={onClose}>
          {headerShown && title && <Dialog.Title className="modal-title">{title}</Dialog.Title>}

          <div
            className={classNames(
              "modal-content-container",
              isFullScreen && "modal-content-container-fullscreen"
            )}>
            {component}
          </div>
          <Dialog.Close asChild>
            <IconButton className="modal-close-button" aria-label="Close" onClick={onClose}>
              <span className="codicon codicon-close" />
            </IconButton>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
