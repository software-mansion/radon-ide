import React, { useMemo } from "react";
import { use$ } from "@legendapp/state/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import classnames from "classnames";
import { useStore } from "../../providers/storeProvider";
import { usePaywalledCallback } from "../../hooks/usePaywalledCallback";
import { Feature } from "../../../common/License";
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
  proFeature?: Feature;
  proFeatureDependencies?: unknown[];
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

export function Item({
  proFeature,
  children,
  className,
  proFeatureDependencies = [],
  ref,
  onSelect = () => {},
  ...props
}: PaywallItemProps) {
  const store$ = useStore();
  const licenseStatus = use$(store$.license.status);
  const isLocked =
    proFeature !== undefined && (licenseStatus === "free" || licenseStatus === "inactive");

  const wrappedOnSelect = proFeature
    ? usePaywalledCallback(onSelect, proFeature, proFeatureDependencies)
    : onSelect;

  return (
    <DropdownMenu.Item
      ref={ref}
      onSelect={wrappedOnSelect}
      className={classnames(className, "paywall-dropdown-menu-item", isLocked && "locked")}
      {...props}>
      {children}
      {isLocked && <ProBadge />}
    </DropdownMenu.Item>
  );
}

interface PaywallSub extends DropdownMenu.DropdownMenuSubProps {
  proFeature?: Feature;
  proFeatureDependencies?: unknown[];
  children: React.ReactNode;
}

export function Sub({ proFeature, proFeatureDependencies = [], children, ...props }: PaywallSub) {
  const store$ = useStore();
  const licenseStatus = use$(store$.license.status);
  const isLocked =
    proFeature !== undefined && (licenseStatus === "free" || licenseStatus === "inactive");

  const handlePaywallCheck = proFeature
    ? usePaywalledCallback(() => {}, proFeature, proFeatureDependencies)
    : undefined;

  // Enhance SubTrigger with paywall styling and behavior if it exists in children
  const enhancedChildren = useMemo(() => {
    return React.Children.map(children, (child) => {
      if (React.isValidElement(child) && child.type === DropdownMenu.SubTrigger) {
        const childProps = child.props as DropdownMenu.DropdownMenuSubTriggerProps;
        const { className: originalClassName, onClick: originalOnClick } = childProps;

        return React.cloneElement(
          child as React.ReactElement<DropdownMenu.DropdownMenuSubTriggerProps>,
          {
            className: classnames(
              originalClassName,
              proFeature && "paywall-dropdown-menu-sub",
              isLocked && "locked"
            ),
            onClick: proFeature ? handlePaywallCheck : originalOnClick,
            children: (
              <>
                {childProps.children}
                {proFeature && <ProBadge />}
              </>
            ),
          }
        );
      }

      return child;
    });
  }, [children, isLocked, proFeature, handlePaywallCheck]);

  return (
    <DropdownMenu.Sub open={!isLocked} {...props}>
      {enhancedChildren}
    </DropdownMenu.Sub>
  );
}

interface PaywallSwitchItemProps extends DropdownMenuComponents.SwitchItemProps {
  proFeature?: Feature;
  proFeatureDependencies?: unknown[];
}

export function SwitchItem({
  onClick = () => {},
  children,
  className,
  proFeature,
  proFeatureDependencies = [],
  ...props
}: PaywallSwitchItemProps) {
  const store$ = useStore();
  const licenseStatus = use$(store$.license.status);
  const isLocked =
    proFeature !== undefined && (licenseStatus === "free" || licenseStatus === "inactive");

  const wrappedOnClick = proFeature
    ? usePaywalledCallback(
        onClick as (...args: any[]) => Promise<void> | void,
        proFeature,
        proFeatureDependencies
      )
    : onClick;

  return (
    <>
      <DropdownMenuComponents.SwitchItem
        className={classnames("paywall-dropdown-menu-item", isLocked && "locked", className)}
        onClick={wrappedOnClick}
        disabled={isLocked}
        {...props}>
        {children}
        {isLocked && <ProBadge style={{ right: "50px" }} />}
      </DropdownMenuComponents.SwitchItem>
    </>
  );
}
