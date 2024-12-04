import * as RadixSelect from "@radix-ui/react-select";
import { PropsWithChildren, ReactNode, forwardRef } from "react";
import classnames from "classnames";
import "./Select.css";

const SelectItem = forwardRef<
  HTMLDivElement,
  PropsWithChildren<RadixSelect.SelectItemProps & { marked?: boolean }>
>(({ children, ...props }, forwardedRef) => {
  return (
    <RadixSelect.Item
      className={classnames("select-item", props.marked ? "select-item-marked" : undefined)}
      {...props}
      ref={forwardedRef}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="select-item-indicator">
        <span className="codicon codicon-check" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
});

type SelectItemType = {
  value: string;
  label: string | ReactNode;
  disabled?: boolean;
  marked?: boolean;
};

type SelectGroupType = { items: SelectItemType[]; label: string | ReactNode };

type SelectItemOrGroup = SelectItemType | SelectGroupType;

const isSingleSelectItem = (option: SelectItemOrGroup): option is SelectItemType => {
  return "value" in option;
};

interface SelectProps {
  value?: string;
  onChange?: (newValue: string) => void;
  items: SelectItemOrGroup[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function Select({ value, onChange, items, placeholder, className, disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={classnames("select-trigger", className, disabled && "select-trigger-disabled")}>
        <RadixSelect.Value style={{ color: "red" }} placeholder={placeholder} />
        <RadixSelect.Icon className="select-icon">
          <span className="codicon codicon-chevron-down" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="select-content">
          <RadixSelect.ScrollUpButton className="select-scroll-button">
            <span className="codicon codicon-chevron-up" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="select-viewport">
            {items.map((item, idx) =>
              !isSingleSelectItem(item) ? (
                <RadixSelect.Group key={idx}>
                  <RadixSelect.Label className="select-label">{item.label}</RadixSelect.Label>
                  {item.items.map((selectItem) => (
                    <SelectItem
                      key={selectItem.value}
                      disabled={selectItem.disabled}
                      marked={selectItem.marked}
                      value={selectItem.value}>
                      {selectItem.label}
                    </SelectItem>
                  ))}
                </RadixSelect.Group>
              ) : (
                <SelectItem
                  key={item.value}
                  disabled={item.disabled}
                  value={item.value}
                  marked={item.marked}>
                  {item.label}
                </SelectItem>
              )
            )}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="select-scroll-button">
            <span className="codicon codicon-chevron-down" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export default Select;
