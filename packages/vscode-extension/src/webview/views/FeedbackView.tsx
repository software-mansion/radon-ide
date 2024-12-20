import { useEffect, useState } from "react";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/shared/Button";
import { FeedbackButton } from "../components/Feedback";
import "./FeedbackView.css";
import { useModal } from "../providers/ModalProvider";
import { useUtils } from "../providers/UtilsProvider";
import { Sentiment } from "../components/SendFeedbackItem";

const CLOSE_MODAL_AFTER = 2400;

type FeedbackViewProps = {
  initialSentiment: Sentiment | undefined;
};

function FeedbackView({ initialSentiment }: FeedbackViewProps) {
  const [isFeedbackSent, setFeedbackSent] = useState(false);
  const { closeModal, showHeader } = useModal();
  const { register, handleSubmit } = useForm();
  const { sendTelemetry } = useUtils();
  const [sentiment, setSentiment] = useState(initialSentiment);

  const onSubmit: SubmitHandler<FieldValues> = (e) => {
    const { message } = e;
    sendTelemetry(`feedback:${sentiment}`, { message });
    showHeader(false);
    setFeedbackSent(true);
  };

  useEffect(() => {
    if (isFeedbackSent) {
      const timer = setTimeout(() => {
        closeModal();
        showHeader(true);
      }, CLOSE_MODAL_AFTER);
      return () => clearTimeout(timer);
    }
  }, [isFeedbackSent]);

  if (isFeedbackSent) {
    return <p className="feedback-thank-you">Thank you for your feedback!</p>;
  }

  return (
    <form className="container" onSubmit={handleSubmit(onSubmit)}>
      <div className="feedback-buttons-container">
        <div className="feedback-button-wrapper">
          <FeedbackButton
            sentiment="positive"
            type="large"
            onClick={() => setSentiment("positive")}
            isActive={sentiment === "positive"}
          />
          <span className="feedback-button-label">I do!</span>
        </div>
        <div className="feedback-button-wrapper">
          <FeedbackButton
            sentiment="negative"
            type="large"
            onClick={() => setSentiment("negative")}
            isActive={sentiment === "negative"}
          />
          <span className="feedback-button-label">Not really...</span>
        </div>
      </div>
      <textarea
        {...register("message")}
        className="feedback-textarea"
        placeholder="Tell us why (optional)"
        rows={5}
      />
      <p className="feedback-report-issue">
        We don't include any details about the project, your setup or the logs. Have a problem?{" "}
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
        <Button type="ternary" disabled={!sentiment}>
          Send feedback
        </Button>
      </div>
    </form>
  );
}

export default FeedbackView;
