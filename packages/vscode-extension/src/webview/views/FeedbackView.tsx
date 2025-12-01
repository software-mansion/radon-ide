import { useEffect, useState } from "react";
import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import Button from "../components/shared/Button";
import { FeedbackButton } from "../components/Feedback";
import "./FeedbackView.css";
import { useModal } from "../providers/ModalProvider";
import { Textarea } from "../components/shared/Textarea";
import { useProject } from "../providers/ProjectProvider";
import { VscodeCheckbox } from "@vscode-elements/react-elements";
import { Sentiment } from "../../common/types";

const CLOSE_MODAL_AFTER = 2400;

type FeedbackViewProps = {
  initialSentiment: Sentiment | undefined;
};

function FeedbackView({ initialSentiment }: FeedbackViewProps) {
  const [isFeedbackSent, setFeedbackSent] = useState(false);
  const { closeModal, showHeader } = useModal();
  const { register, handleSubmit } = useForm();
  const { project } = useProject();
  const [sentiment, setSentiment] = useState(initialSentiment);
  const [includeLogs, setIncludeLogs] = useState(false);

  const onSubmit: SubmitHandler<FieldValues> = (e) => {
    const { message } = e;
    if (sentiment) {
      project.sendFeedback(sentiment, { message });
    }
    showHeader(false);
    setFeedbackSent(true);
  };

  useEffect(() => {
    setIncludeLogs(false);
  }, [sentiment]);

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
    <form className="container" data-testid="feedback-view" onSubmit={handleSubmit(onSubmit)}>
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
      <Textarea
        {...register("message")}
        className="feedback-textarea"
        placeholder="Tell us why (optional)"
        rows={5}
      />
      {/* Note(Filip Kamiński): this feature is disabled for no as it  
      would require a lot of additional work on customer portal side,
      but the ground work for it from extension side is already here */}
      {/* eslint-disable-next-line */}
      {false && sentiment === "negative" && (
        <div className="checkbox-container feedback-logs-checkbox">
          <VscodeCheckbox
            checked={includeLogs}
            onClick={() => setIncludeLogs(!includeLogs)}
            label="Include diagnostic logs with feedback"
          />
        </div>
      )}
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
        <Button type="ternary" disabled={!sentiment}>
          Send feedback
        </Button>
      </div>
    </form>
  );
}

export default FeedbackView;
