import { useRef, useState } from "react";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import "./ActivateLicenseView.css";
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import Button from "../components/shared/Button";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";

export function ActivateLicenseView() {
  const { project } = useProject();
  const { closeModal } = useModal();
  const { register, handleSubmit } = useForm();

  const [isLoading, setIsLoading] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(true);
  const [wasRejected, setWasRejected] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit: SubmitHandler<FieldValues> = (e, data) => {
    setIsLoading(true);

    const activationPromise = project.activateLicense(data?.target[0].value);

    activationPromise.then((success) => {
      if (success) {
        closeModal();
      } else {
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
        {wasRejected ? (
          <div className="error-text">
            Unable to verify the key. Please ensure your license key is correct. You can find a
            license activation manual{" "}
            <a
              href="https://ide.swmansion.com/docs/guides/activation-manual"
              target="_blank"
              rel="noopener noreferrer">
              here
            </a>
            .
          </div>
        ) : (
          <div className="info-text">
            Your license should be available in the customer portal, or shared to you by your
            company administration. If you don't have a license you can{" "}
            <a href="https://portal.ide.swmansion.com/" target="_blank" rel="noopener noreferrer">
              get it here
            </a>
            .
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
            Submit
          </Button>
        )}
      </div>
    </form>
  );
}
