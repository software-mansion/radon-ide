import * as RadixSelect from "@radix-ui/react-select";
import { PropsWithChildren, ReactNode, forwardRef } from "react";
import classnames from "classnames";
import "./Select.css";

const SelectItem = forwardRef<HTMLDivElement, PropsWithChildren<RadixSelect.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => {
    return (
      <RadixSelect.Item className="SelectItem" {...props} ref={forwardedRef}>
        <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
        <RadixSelect.ItemIndicator className="SelectItemIndicator">
          <span className="codicon codicon-chevron-down" />
        </RadixSelect.ItemIndicator>
      </RadixSelect.Item>
    );
  }
);

type SelectItemType = { value: string; label: string | ReactNode; disabled?: boolean };

type SelectGroupType = { options: SelectItemType[]; label: string | ReactNode };

type SelectOption = SelectItemType | SelectGroupType;

const isSingleSelectItem = (option: SelectOption): option is SelectItemType => {
  return "value" in option;
};

interface SelectProps {
  value?: string;
  onChange?: (newValue: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

function Select({ value, onChange, options, placeholder, className }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger className={classnames("SelectTrigger", className)}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="SelectIcon">
          <span className="codicon codicon-chevron-down" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="SelectContent">
          <RadixSelect.ScrollUpButton className="SelectScrollButton">
            <span className="codicon codicon-chevron-up" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="SelectViewport">
            {options.map((option, idx) =>
              !isSingleSelectItem(option) ? (
                <RadixSelect.Group key={idx}>
                  <RadixSelect.Label className="SelectLabel">{option.label}</RadixSelect.Label>
                  {option.options.map((selectItem) => (
                    <SelectItem
                      key={selectItem.value}
                      disabled={selectItem.disabled}
                      value={selectItem.value}>
                      {selectItem.label}
                    </SelectItem>
                  ))}
                </RadixSelect.Group>
              ) : (
                <SelectItem key={option.value} disabled={option.disabled} value={option.value}>
                  {option.label}
                </SelectItem>
              )
            )}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="SelectScrollButton">
            <span className="codicon codicon-chevron-down" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export default Select;
