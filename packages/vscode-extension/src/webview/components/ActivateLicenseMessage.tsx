import "./ActivateLicenseMessage.css";
import { useProject } from "../providers/ProjectProvider";
import Button from "./shared/Button";
import { useModal } from "../providers/ModalProvider";
import { ActivateLicenseView } from "../views/ActivateLicenseView";

export function ActivateLicenseMessage() {
  const { project } = useProject();
  const { openModal } = useModal();

  return (
    <div className="activate-license-message-overlay">
      <div className="activate-license-message-container">
        <div className="activate-license-icon">
          <span className="codicon codicon-lock" />
        </div>

        <h2 className="activate-license-title">License Required</h2>

        <p className="activate-license-description">
          Radon IDE has stopped working because your license is not activated.
        </p>

        <div className="activate-license-actions">
          <Button
            className="activate-license-primary-button"
            onClick={() => {
              project.sendTelemetry("activateLicenseMessageClicked");
              openModal(<ActivateLicenseView />, { title: "Activate License" });
            }}>
            Activate License
          </Button>

          <Button
            className="activate-license-secondary-button"
            onClick={() => {
              project.sendTelemetry("getLicenseFromMessageClicked");
              project.openExternalUrl("https://ide.swmansion.com/pricing");
            }}>
            Get License
          </Button>
        </div>

        <p className="activate-license-footer">
          Visit{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              project.openExternalUrl("https://ide.swmansion.com/pricing");
            }}>
            ide.swmansion.com/pricing
          </a>{" "}
          to learn more
        </p>
      </div>
    </div>
  );
}
