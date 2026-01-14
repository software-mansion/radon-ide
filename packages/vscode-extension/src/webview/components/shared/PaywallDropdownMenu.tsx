import React, { useMemo } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import classnames from "classnames";
import { Feature, FeatureAvailabilityStatus } from "../../../common/License";
import { useFeatureAvailability } from "../../hooks/useFeatureAvailability";
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
  ...props
}: PaywallItemProps) {
  const isPaywalled = useFeatureAvailability(feature) === FeatureAvailabilityStatus.PAYWALLED;
  const isAvailable = useFeatureAvailability(feature) === FeatureAvailabilityStatus.AVAILABLE;

  const handleSelect = usePaywalledCallback(onSelect, feature, [onSelect]);

  return (
    <DropdownMenu.Item
      onSelect={handleSelect}
      className={classnames(className, !isAvailable && "unavailable")}
      {...props}>
      {children}
      {isPaywalled && <ProBadge />}
    </DropdownMenu.Item>
  );
}

interface PaywallSubProps extends DropdownMenu.DropdownMenuSubProps {
  feature: Feature;
  paywallCallbackDependencies?: unknown[];
  children: React.ReactNode;
}

export function Sub({ feature, children, open, ...props }: PaywallSubProps) {
  const isPaywalled = useFeatureAvailability(feature) === FeatureAvailabilityStatus.PAYWALLED;
  const isAvailable = useFeatureAvailability(feature) === FeatureAvailabilityStatus.AVAILABLE;

  const isOpen = isAvailable && open;

  const handleOnClick = usePaywalledCallback((f: () => void | undefined) => f?.(), feature, []);

  // Enhance SubTrigger with paywall styling and behavior if it exists in children
  const enhancedChildren = useMemo(() => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === DropdownMenu.SubTrigger) {
        const childProps = child.props as DropdownMenu.DropdownMenuSubTriggerProps;
        const { className: originalClassName, onClick: originalOnClick } = childProps;

        return React.cloneElement(
          child as React.ReactElement<DropdownMenu.DropdownMenuSubTriggerProps>,
          {
            className: classnames(originalClassName, !isAvailable && "unavailable"),
            onClick: (e) => handleOnClick(() => originalOnClick?.(e)),
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
  }, [children, isPaywalled, feature]);

  return (
    <DropdownMenu.Sub open={isOpen} {...props}>
      {enhancedChildren}
    </DropdownMenu.Sub>
  );
}

interface PaywallSwitchItemProps extends DropdownMenuComponents.SwitchItemProps {
  feature: Feature;
}

export function SwitchItem({ children, className, feature, ...props }: PaywallSwitchItemProps) {
  const isPaywalled = useFeatureAvailability(feature) === FeatureAvailabilityStatus.PAYWALLED;
  const isAvailable = useFeatureAvailability(feature) === FeatureAvailabilityStatus.AVAILABLE;

  const handleOnClick = usePaywalledCallback(() => {}, feature, []);

  return (
    <>
      <DropdownMenuComponents.SwitchItem
        className={classnames(className, !isAvailable && "unavailable")}
        onMenuItemClick={handleOnClick}
        disabled={!isAvailable}
        {...props}>
        {children}
        {isPaywalled && <ProBadge style={{ right: "50px" }} />}
      </DropdownMenuComponents.SwitchItem>
    </>
  );
}
