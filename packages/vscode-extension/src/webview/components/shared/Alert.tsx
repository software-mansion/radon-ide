import React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import "./Alert.css";
import ToolbarButton from "./VscodeToolbarButton";

interface AlertProps {
  open: boolean;
  title: string;
  description?: string;
  actions: React.ReactNode;
  type: "error" | "warning" | "info";
  close?: () => void;
}

function Alert({ open, title, description, actions, type, close }: AlertProps) {
  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal>
        <div className="alert-dialog-content" data-testid="alert-dialog-content">
          <div className="alert-dialog-content-container">
            <div className="alert-dialog-icon">
              <span className={`codicon codicon-${type}`} />
            </div>
            <AlertDialog.Title className="alert-dialog-title" data-testid="alert-dialog-title">
              {title}
            </AlertDialog.Title>
            {close && (
              <ToolbarButton className="alert-dialog-close-button" onClick={close} title="Close">
                <span className="codicon codicon-close" />
              </ToolbarButton>
            )}
          </div>
          {description && <p className="alert-dialog-description">{description}</p>}
          <div className="alert-dialog-actions">{actions}</div>
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default Alert;
