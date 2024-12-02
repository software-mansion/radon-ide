import { useRef, useState } from "react";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import "./ActivateLicenseView.css";
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
  const [activateDeviceResult, setActivateDeviceResult] = useState<ActivateDeviceResult | null>(
    null
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit: SubmitHandler<FieldValues> = (e, data) => {
    setIsLoading(true);

    const activationPromise = project.activateLicense(data?.target[0].value);

    activationPromise.then((activationResult) => {
      if (activationResult === ActivateDeviceResult.succeeded) {
        closeModal();
      } else {
        setActivateDeviceResult(activationResult);
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
        {activateDeviceResult === null && (
          <div className="info-text">
            You can find your license key on the{" "}
            <a href="https://portal.ide.swmansion.com/" target="_blank" rel="noopener noreferrer">
              Radon IDE customer portal
            </a>
            . If you don't have a license, you can purchase it{" "}
            <a href="https://ide.swmansion.com/pricing" target="_blank" rel="noopener noreferrer">
              here
            </a>
            .
          </div>
        )}
        {activateDeviceResult === ActivateDeviceResult.unableToVerify && (
          <div className="error-text">
            We were unable to verify the license key at this point. Please consult the{" "}
            <a
              href="https://ide.swmansion.com/docs/guides/activation-manual"
              target="_blank"
              rel="noopener noreferrer">
              license activation instructions
            </a>{" "}
            and try again once you check the provided key is valid.
          </div>
        )}
        {activateDeviceResult === ActivateDeviceResult.keyVerificationFailed && (
          <div className="error-text">
            Provided key is not a valid license key. You can find your key on the{" "}
            <a href="https://portal.ide.swmansion.com/" target="_blank" rel="noopener noreferrer">
              Radon IDE customer portal
            </a>
            . Please follow the{" "}
            <a
              href="https://ide.swmansion.com/docs/guides/activation-manual"
              target="_blank"
              rel="noopener noreferrer">
              license activation instructions
            </a>{" "}
            if you need further assistance.
          </div>
        )}
        {activateDeviceResult === ActivateDeviceResult.notEnoughSeats && (
          <div className="error-text">
            Your license does not have any available seats. Log to the{" "}
            <a href="https://portal.ide.swmansion.com/" target="_blank" rel="noopener noreferrer">
              Radon IDE customer portal
            </a>{" "}
            to manage seats assigned to the license seats or purchase additional seats.
          </div>
        )}
        {activateDeviceResult === ActivateDeviceResult.connectionFailed && (
          <div className="error-text">
            Activating license key requires a network connection. Make sure you are connected and
            try activating the key again. In case of any issues please consult our
            <a
              href="https://ide.swmansion.com/docs/guides/activation-manual"
              target="_blank"
              rel="noopener noreferrer">
              license activation instructions
            </a>
          </div>
        )}
        {activateDeviceResult === ActivateDeviceResult.succeeded && (
          <div className="info-text">Your license has been successfully activated.</div>
        )}
      </div>
      {activateDeviceResult !== ActivateDeviceResult.succeeded && (
        <input
          {...register("licenseKey")}
          ref={inputRef}
          className="license-input"
          type="text"
          onChange={onChange}
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
        />
      )}
      <div className="submit-row">
        {activateDeviceResult !== ActivateDeviceResult.succeeded ? (
          <Button type="secondary" disabled={disableSubmit || isLoading}>
            Activate
          </Button>
        ) : (
          <Button type="secondary" onClick={closeModal}>
            Ok
          </Button>
        )}
      </div>
    </form>
  );
}
