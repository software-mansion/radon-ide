import React, { useMemo } from "react";
import { use$ } from "@legendapp/state/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import classnames from "classnames";
import { useStore } from "../../providers/storeProvider";
import { usePaywalledCallback } from "../../hooks/usePaywalledCallback";
import { Feature, isFeaturePaywalled } from "../../../common/License";
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
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);
  const isPaywalled = isFeaturePaywalled(featuresAvailability, feature);

  const wrappedOnSelect = usePaywalledCallback(onSelect, feature, paywallCallbackDependencies);

  return (
    <DropdownMenu.Item
      onSelect={wrappedOnSelect}
      className={classnames(className, isPaywalled && "paywalled")}
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

export function Sub({ feature, paywallCallbackDependencies = [], children, ...props }: PaywallSub) {
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);
  const isPaywalled = isFeaturePaywalled(featuresAvailability, feature);

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
            className: classnames(originalClassName, isPaywalled && "paywalled"),
            onClick: feature ? handlePaywallCheck : originalOnClick,
            children: (
              <>
                {childProps.children}
                {feature && <ProBadge />}
              </>
            ),
          }
        );
      }

      return child;
    });
  }, [children, isPaywalled, feature, handlePaywallCheck]);

  return (
    <DropdownMenu.Sub open={!isPaywalled} {...props}>
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
  const store$ = useStore();
  const featuresAvailability = use$(store$.license.featuresAvailability);
  const isPaywalled = isFeaturePaywalled(featuresAvailability, feature);

  const wrappedOnClick = usePaywalledCallback(
    onClick as (...args: any[]) => Promise<void> | void,
    feature,
    paywallCallbackDependencies
  );

  return (
    <>
      <DropdownMenuComponents.SwitchItem
        className={classnames(className, isPaywalled && "paywalled")}
        onClick={wrappedOnClick}
        disabled={isPaywalled}
        {...props}>
        {children}
        {isPaywalled && <ProBadge style={{ right: "50px" }} />}
      </DropdownMenuComponents.SwitchItem>
    </>
  );
}
