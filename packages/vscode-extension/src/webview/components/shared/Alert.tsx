import React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import "./Alert.css";

interface AlertProps {
  open: boolean;
  title: string;
  description?: string;
  actions: React.ReactNode;
  type?: "error";
}

function Alert({ open, title, description, actions, type = "error" }: AlertProps) {
  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal>
        <div className="alert-dialog-content" data-testid="alert-dialog-content">
          <div className="alert-dialog-content-container">
            {type === "error" && (
              <div className="alert-dialog-error">
                <span className="codicon codicon-error" />
              </div>
            )}
            <AlertDialog.Title className="alert-dialog-title">{title}</AlertDialog.Title>
            <div className="alert-dialog-actions">{actions}</div>
          </div>
          {description && (
            <AlertDialog.Description className="alert-dialog-description">
              {description}
            </AlertDialog.Description>
          )}
        </div>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default Alert;
