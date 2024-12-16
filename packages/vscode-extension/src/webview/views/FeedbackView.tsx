import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/shared/Button";
import { FeedbackButton } from "../components/Feedback";
import "./FeedbackView.css";
import { useModal } from "../providers/ModalProvider";
import { useUtils } from "../providers/UtilsProvider";

function FeedbackView() {
  const { closeModal } = useModal();
  const { register, handleSubmit } = useForm();
  const { sendTelemetry } = useUtils();

  const onSubmit: SubmitHandler<FieldValues> = (e, data) => {
    console.log(data);
  };

  return (
    <form className="container" onSubmit={handleSubmit(onSubmit)}>
      <div className="feedback-buttons-container">
        <div className="feedback-button-wrapper">
          <FeedbackButton sentiment="positive" type="large" />
          <span className="feedback-button-label">I do!</span>
        </div>
        <div className="feedback-button-wrapper">
          <FeedbackButton sentiment="negative" type="large" />
          <span className="feedback-button-label">Not really...</span>
        </div>
      </div>
      <textarea
        {...register("feeedbackMessage")}
        className="feedback-textarea"
        placeholder="Tell us why (optional)"
        rows={5}
      />
      <p className="feedback-report-issue">
        Have a problem?{" "}
        <a
          href="https://github.com/software-mansion/radon-ide/issues/new/choose"
          target="_blank"
          rel="noopener noreferrer">
          Report an issue on GitHub
        </a>
        .
      </p>
      <div className="feedback-row">
        <Button type="secondary" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="ternary">Send feedback</Button>
      </div>
    </form>
  );
}

export default FeedbackView;
