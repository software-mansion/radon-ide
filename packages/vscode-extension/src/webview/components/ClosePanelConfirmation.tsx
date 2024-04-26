import "./ClosePanelConfirmation.css";
import { DeviceInfo } from "../../common/DeviceManager";
import { useEffect, useState } from "react";
import { useDevices } from "../providers/DevicesProvider";
import Button from "./shared/Button";
import { useModal } from "../providers/ModalProvider";

function ColsePanelConfirmation({
  onConfirm,
  onClose,
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { showHeader } = useModal();
  useEffect(() => {
    showHeader(false);
    return () => {
      showHeader(true);
    };
  });

  return (
    <div className="close-panel-wrapper">
      <h2 className="close-panel-title">Are you sure you want to close IDE?</h2>
      <p className="close-panel-subtitle">This action cannot be undone.</p>
      <div className="close-panel-button-group">
        <Button type="secondary" className="close-panel-button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="close-panel-button"
          type="ternary"
          onClick={async () => {
            try {
              onConfirm();
            } finally {
              onClose();
            }
          }}>
          Confirm
        </Button>
      </div>
    </div>
  );
}

export default ColsePanelConfirmation;
