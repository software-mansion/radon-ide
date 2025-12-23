import React, { useMemo } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import classnames from "classnames";
import { Feature } from "../../../common/License";
import {
  useIsFeatureAvailable,
  useIsFeaturePaywalled,
} from "../../hooks/useFeatureAvailabilityCheck";
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
  paywallCallbackDependencies?: unknown[];
}

export function SwitchItem({
  onClick = () => {},
  children,
  className,
  feature,
  paywallCallbackDependencies = [],
  ...props
}: PaywallSwitchItemProps) {
  const isPaywalled = useIsFeaturePaywalled(feature);
  const isAvailable = useIsFeatureAvailable(feature);

  const wrappedOnClick = usePaywalledCallback(
    onClick as (...args: any[]) => Promise<void> | void,
    feature,
    paywallCallbackDependencies
  );

  return (
    <>
      <DropdownMenuComponents.SwitchItem
        className={classnames(className, !isAvailable && "paywalled")}
        onClick={wrappedOnClick}
        disabled={!isAvailable}
        {...props}>
        {children}
        {isPaywalled && <ProBadge style={{ right: "50px" }} />}
      </DropdownMenuComponents.SwitchItem>
    </>
  );
}
