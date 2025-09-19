import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

import "./Modal.css";
import classNames from "classnames";
import IconButton from "./IconButton";

interface ModalProps {
  title?: string;
  component: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  headerShown?: boolean;
  fullscreen?: boolean;
}

export default function Modal({
  title,
  component,
  isOpen,
  onClose,
  headerShown,
  fullscreen,
}: ModalProps) {
  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" onClick={onClose} />
        <Dialog.Content
          className={classNames("modal-content", fullscreen && "modal-content-fullscreen")}
          onEscapeKeyDown={onClose}
          aria-description={title}>
          {headerShown && title ? (
            <Dialog.Title className="modal-title">{title}</Dialog.Title>
          ) : (
            <VisuallyHidden.Root>
              <Dialog.Title className="modal-title">Modal</Dialog.Title>
            </VisuallyHidden.Root>
          )}

          <div
            className={classNames(
              "modal-content-container",
              fullscreen && "modal-content-container-fullscreen"
            )}>
            {component}
          </div>
          <Dialog.Close asChild>
            <IconButton
              className="modal-close-button"
              dataTest="modal-close-button"
              aria-label="Close"
              onClick={onClose}>
              <span className="codicon codicon-close" />
            </IconButton>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
