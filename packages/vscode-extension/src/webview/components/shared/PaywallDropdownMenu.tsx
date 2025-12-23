import React, { useMemo } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import classnames from "classnames";
import { Feature } from "../../../common/License";
import {
  useIsFeatureAvailable,
  useIsFeaturePaywalled,
} from "../../hooks/useFeatureAvailabilityCheck";
import { usePaywall } from "../../hooks/usePaywall";
import { useAdminBlock } from "../../hooks/useAdminBlock";
import { usePaywalledCallback } from "../../hooks/usePaywalledCallback";
import * as DropdownMenuComponents from "../shared/DropdownMenuComponents";

import "./PaywallDropdownMenu.css";

interface ProBadgeProps {
  style?: React.CSSProperties;
}

function ProBadge({ style }: ProBadgeProps) {
  return (
    <span className="paywall-dropdown-menu-badge" style={style}>
      Pro
    </span>
  );
}

interface PaywallItemProps extends DropdownMenu.DropdownMenuItemProps {
  feature: Feature;
  paywallCallbackDependencies?: unknown[];
  children: React.ReactNode;
}

export function Item({
  children,
  className,
  onSelect = () => {},
  feature,
  paywallCallbackDependencies = [],
  ...props
}: PaywallItemProps) {
  const isPaywalled = useIsFeaturePaywalled(feature);
  const isAvailable = useIsFeatureAvailable(feature);

  const wrappedOnSelect = usePaywalledCallback(onSelect, feature, paywallCallbackDependencies);

  return (
    <DropdownMenu.Item
      onSelect={wrappedOnSelect}
      className={classnames(className, !isAvailable && "paywalled")}
      {...props}>
      {children}
      {isPaywalled && <ProBadge />}
    </DropdownMenu.Item>
  );
}

interface PaywallSub extends DropdownMenu.DropdownMenuSubProps {
  feature: Feature;
  paywallCallbackDependencies?: unknown[];
  children: React.ReactNode;
}

export function Sub({
  feature,
  paywallCallbackDependencies = [],
  children,
  open,
  ...props
}: PaywallSub) {
  const isPaywalled = useIsFeaturePaywalled(feature);
  const isAvailable = useIsFeatureAvailable(feature);

  const isOpen = isAvailable ? open : false;

  const handlePaywallCheck = usePaywalledCallback(() => {}, feature, paywallCallbackDependencies);

  // Enhance SubTrigger with paywall styling and behavior if it exists in children
  const enhancedChildren = useMemo(() => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === DropdownMenu.SubTrigger) {
        const childProps = child.props as DropdownMenu.DropdownMenuSubTriggerProps;
        const { className: originalClassName, onClick: originalOnClick } = childProps;

        return React.cloneElement(
          child as React.ReactElement<DropdownMenu.DropdownMenuSubTriggerProps>,
          {
            className: classnames(originalClassName, !isAvailable && "paywalled"),
            onClick: feature ? handlePaywallCheck : originalOnClick,
            children: (
              <>
                {childProps.children}
                {isPaywalled && <ProBadge />}
              </>
            ),
          }
        );
      }

      return child;
    });
  }, [children, isPaywalled, feature, handlePaywallCheck]);

  return (
    <DropdownMenu.Sub open={isOpen} {...props}>
      {enhancedChildren}
    </DropdownMenu.Sub>
  );
}

interface PaywallSwitchItemProps extends DropdownMenuComponents.SwitchItemProps {
  feature: Feature;
}

export function SwitchItem({
  children,
  className,
  onClick = () => {},
  feature,
  ...props
}: PaywallSwitchItemProps) {
  const openPaywall = usePaywall().openPaywall;
  const openAdminBlock = useAdminBlock().openAdminBlock;
  const isPaywalled = useIsFeaturePaywalled(feature);
  const isAvailable = useIsFeatureAvailable(feature);

  const openPaywallOnClick = () => {
    if (isPaywalled) {
      openPaywall(undefined, feature);
      return;
    }
    if (!isAvailable) {
      openAdminBlock();
      return;
    }
    onClick();
  };

  return (
    <>
      <DropdownMenuComponents.SwitchItem
        className={classnames(className, !isAvailable && "paywalled")}
        onClick={openPaywallOnClick}
        disabled={!isAvailable}
        {...props}>
        {children}
        {isPaywalled && <ProBadge style={{ right: "50px" }} />}
      </DropdownMenuComponents.SwitchItem>
    </>
  );
}
