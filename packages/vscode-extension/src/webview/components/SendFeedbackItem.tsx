import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { useModal } from "../providers/ModalProvider";
import FeedbackView from "../views/FeedbackView";
import { Feedback } from "./Feedback";

export type Sentiment = "positive" | "negative";

export function SendFeedbackItem() {
  const { openModal } = useModal();

  const [sentiment, setSentiment] = useState<Sentiment | undefined>();

  return (
    <DropdownMenu.Item
      className="dropdown-menu-item"
      onSelect={() => {
        openModal(
          "Do you enjoy using Radon IDE today?",
          <FeedbackView sentiment={sentiment} setSentiment={setSentiment} />
        );
      }}>
      <span className="codicon codicon-feedback" />
      <div className="dropdown-menu-item-content">
        Send feedback
        <Feedback sentiment={sentiment} setSentiment={setSentiment} />
      </div>
    </DropdownMenu.Item>
  );
}
