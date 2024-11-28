import { useRef, useState } from "react";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import "./ActivateLicenseView.css";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import Button from "../components/shared/Button";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { ActivateDeviceResult } from "../../common/Project";

export function ActivateLicenseView() {
  const { project } = useProject();
  const { closeModal } = useModal();
  const { register, handleSubmit } = useForm();

  const [isLoading, setIsLoading] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(true);
  const [wasRejected, setWasRejected] = useState(false);
  const [wasEnoughSeats, setWasEnoughSeats] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit: SubmitHandler<FieldValues> = (e, data) => {
    setIsLoading(true);

    const activationPromise = project.activateLicense(data?.target[0].value);

    activationPromise.then((activationResult) => {
      if (activationResult === ActivateDeviceResult.succeeded) {
        closeModal();
      } else {
        if (activationResult === ActivateDeviceResult.notEnoughSeats) {
          setWasEnoughSeats(false);
        }
        setWasRejected(true);
      }
      setIsLoading(false);
    });
  };

  const onChange = () => {
    const newInput = inputRef.current?.value;
    if (newInput) {
      const isValidKey = /^[0-9A-F]{4}(?:-[0-9A-F]{4}){7}$/.test(newInput);
      setDisableSubmit(!isValidKey);
      return;
    }
    setDisableSubmit(true);
  };

  return (
    <form className="container" onSubmit={handleSubmit(onSubmit)}>
      <div className="info-row">
        {!wasRejected && (
          <div className="info-text">
            You can find your license key on the Radon IDE customer portal (
            <a href="https://portal.ide.swmansion.com/" target="_blank" rel="noopener noreferrer">
              link
            </a>
            ) If you don't have a license, you can purchase it{" "}
            <a href="https://ide.swmansion.com/pricing" target="_blank" rel="noopener noreferrer">
              here
            </a>
            .
          </div>
        )}
        {wasRejected && wasEnoughSeats && (
          <div className="error-text">
            Unable to verify the key. Please ensure your license key is correct. Check this{" "}
            <a
              href="https://ide.swmansion.com/docs/guides/activation-manual"
              target="_blank"
              rel="noopener noreferrer">
              link
            </a>{" "}
            for instructions.
          </div>
        )}
        {!wasEnoughSeats && (
          <div className="error-text">
            Your organization does not any available seats left, you can purchase more on the Radon
            IDE customer portal (
            <a href="https://portal.ide.swmansion.com/" target="_blank" rel="noopener noreferrer">
              link
            </a>
            ).
          </div>
        )}
      </div>
      <input
        {...register("licenseKey")}
        ref={inputRef}
        className="license-input"
        type="text"
        onChange={onChange}
        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
      />
      <div className="submit-row">
        {isLoading ? (
          <VSCodeProgressRing />
        ) : (
          <Button type="secondary" disabled={disableSubmit}>
            Activate
          </Button>
        )}
      </div>
    </form>
  );
}
