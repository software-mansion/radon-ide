import classNames from "classnames";
import "./SubscriptionOption.css";

interface SubscriptionOptionProps {
  planType: "monthly" | "yearly";
  planName: string;
  planPrice: string;
  planDescription: string;
  showSaving?: boolean;
  savingText?: string;
  isSelected: boolean;
  onClick: () => void;
}

function SubscriptionOption({
  planType,
  planName,
  planPrice,
  planDescription,
  showSaving = false,
  savingText = "",
  isSelected,
  onClick,
}: SubscriptionOptionProps) {
  return (
    <div className={classNames("subscription-option", isSelected && "selected")} onClick={onClick}>
      <div className="plan-header">
        <span className="plan-name">
          {planName}
          {showSaving && savingText && <span className="plan-saving">{savingText}</span>}
        </span>
        <span className="plan-price">
          <span>{planPrice}</span> / {planType === "yearly" ? "year" : "month"}
        </span>
      </div>
      <div className="plan-description">{planDescription}</div>
    </div>
  );
}

export default SubscriptionOption;
