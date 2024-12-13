import { MouseEvent } from "react";
import "./Feedback.css";
import { getTelemetryReporter } from "../../utilities/telemetry";

function Feedback() {
  return (
    <div className="feedback">
      <FeedbackButton sentiment="positive" />
      <FeedbackButton sentiment="negative" />
    </div>
  );
}

type FeedbackButtonProps = {
  sentiment: "positive" | "negative";
};

export function FeedbackButton({ sentiment }: FeedbackButtonProps) {
  const handleFeedback = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    getTelemetryReporter().sendTelemetryEvent(`feedback:${sentiment}`);
  };

  if (sentiment === "positive") {
    return (
      <button className="feedback-button feedback-button-positive" onClick={handleFeedback}>
        <span className="codicon codicon-thumbsup" />
      </button>
    );
  }

  return (
    <button className="feedback-button feedback-button-negative" onClick={handleFeedback}>
      <span className="codicon codicon-thumbsdown" />
    </button>
  );
}

export default Feedback;
