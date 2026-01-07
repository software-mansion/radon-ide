import classnames from "classnames";
import { Feature, FeatureAvailabilityStatus } from "../../../common/License";
import { PropsWithDataTest } from "../../../common/types";
import { useFeatureAvailability } from "../../hooks/useFeatureAvailability";
import { usePaywalledCallback } from "../../hooks/usePaywalledCallback";
import IconButton, { type IconButtonProps } from "./IconButton";

import "./IconButton.css";

interface PaywallIconButtonProps extends PropsWithDataTest<IconButtonProps> {
  feature: Feature;
}

const PaywallIconButton = ({
  feature,
  className = "",
  onClick = () => {},
  ...props
}: PaywallIconButtonProps) => {
  const isPaywalled = useFeatureAvailability(feature) === FeatureAvailabilityStatus.PAYWALLED;
  const badge = isPaywalled ? <span className={"pro-feature-badge"}>Pro</span> : null;

  const handleOnClick = usePaywalledCallback(onClick, feature, [onClick]);
  return (
    <IconButton
      {...props}
      onClick={handleOnClick}
      badge={badge}
      className={classnames(className, isPaywalled && "unavailable")}
    />
  );
};

export default PaywallIconButton;
