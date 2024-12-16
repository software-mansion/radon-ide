import { MouseEvent } from "react";
import "./Feedback.css";
import classNames from "classnames";
import { useUtils } from "../providers/UtilsProvider";

export type Sentiment = "positive" | "negative";

export default function Feedback() {
  const { sendTelemetry } = useUtils();

  const handleFeedback = (event: MouseEvent<HTMLButtonElement>, sentiment: Sentiment) => {
    event.preventDefault();
    sendTelemetry(`feedback:${sentiment}`);
  };

  return (
    <div className="feedback">
      <FeedbackButton sentiment="positive" onClick={(e) => handleFeedback(e, "positive")} />
      <FeedbackButton sentiment="negative" onClick={(e) => handleFeedback(e, "negative")} />
    </div>
  );
}

type FeedbackButtonProps = {
  sentiment: Sentiment;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  type?: "small" | "large";
  isActive?: boolean;
};

export function FeedbackButton({
  sentiment,
  onClick,
  type = "small",
  isActive,
}: FeedbackButtonProps) {
  if (sentiment === "positive") {
    return (
      <button
        className={classNames(
          "feedback-button feedback-button-positive",
          isActive && "feedback-button-positive-active",
          type === "large" && "feedback-button-large"
        )}
        type="button"
        onClick={onClick}>
        <span className="codicon codicon-thumbsup" />
      </button>
    );
  }

  return (
    <button
      className={classNames(
        "feedback-button feedback-button-negative",
        isActive && "feedback-button-negative-active",
        type === "large" && "feedback-button-large"
      )}
      type="button"
      onClick={onClick}>
      <span className="codicon codicon-thumbsdown" />
    </button>
  );
}
