import React, { PropsWithChildren, useEffect } from "react";
import * as Select from "@radix-ui/react-select";
import { VscodeOption, VscodeSingleSelect, VscodeTextfield } from "@vscode-elements/react-elements";
import "./UrlSelect.css";
import { set } from "lodash";

export type UrlItem = { id: string; name: string };

const SelectItem = React.forwardRef<HTMLDivElement, PropsWithChildren<Select.SelectItemProps>>(
  ({ children, ...props }, forwardedRef) => (
    <Select.Item className="url-select-item" {...props} ref={forwardedRef}>
      <Select.ItemText style={{ width: 1 }}>
        <div className="url-select-item-text">{children}</div>
      </Select.ItemText>
    </Select.Item>
  )
);

interface UrlSelectProps {
  value: string;
  onValueChange: (newValue: string) => void;
  recentItems: UrlItem[];
  items: UrlItem[];
  disabled?: boolean;
}

function UrlSelect({ onValueChange, recentItems, items, value, disabled }: UrlSelectProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [filteredItems, setFilteredItems] = React.useState<UrlItem[]>([]);

  // We use two lists for URL selection: one with recently used URLs and another
  // with all available URLs. Since recentItems is a subset of items, each recentItems's
  // value is prefixed to differentiate their origins when presented in the Select
  // component. This prefix is stripped off when the selected value is passed back
  // through onValueChange.

  const handleValueChange = (newSelection: string) => {
    onValueChange(stripRecentPrefix(newSelection));
  };

  const stripRecentPrefix = (id: string) => {
    return id.replace(/^recent#/, "");
  };

  const stripNameFromId = (id: string) => {
    const item = items.find((item) => item.id === id);
    if (item) {
      return item.name;
    }
    return id;
  };

  useEffect(() => {
    setInputValue(stripNameFromId(value));
  }, [value]);

  useEffect(() => {
    if (!disabled) {
      const filtered = items.filter((item) => item.name.toLowerCase().includes(inputValue.toLowerCase()));
      setFilteredItems(filtered);
    }
  }, [inputValue, items]);

  return (    
    // kinda broken, but opens correctly without focusing away from the input
    <span className="url-select-group" onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}>
    <VscodeTextfield
      className="url-select-input"
      disabled={disabled}
      type="text"
      placeholder="Enter path"
      value={inputValue}
      onInput={(e) => {
        e.preventDefault();
        const fieldValue = (e.target as HTMLInputElement).value;
        setInputValue(fieldValue);
      }}

      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const fieldValue = (e.target as HTMLInputElement).value;
          if (fieldValue) {
            setInputValue(fieldValue);
            handleValueChange(fieldValue);
          }
          (e.target as HTMLInputElement).parentElement?.blur();
          (e.target as HTMLInputElement).blur();
          setIsFocused(false);
        }
        if (e.key === "Escape") {
          (e.target as HTMLInputElement).blur();
          (e.target as HTMLInputElement).parentElement?.blur();
          setIsFocused(false);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIsFocused(true);
          const select = document.querySelector<HTMLSelectElement>(".url-select-dropdown");
          if (select) {
            select.focus();
          }
        }
        // else {
        //   const fieldValue = (e.target as HTMLInputElement).value;
        //   setInputValue(fieldValue);
        // }
      }}
    />

    {/* TODO: fix weird border radius overflow, add padding and prevent wrap in vscodeoptions */}
    <VscodeSingleSelect
      className="url-select-dropdown"
      disabled={disabled}
      value={inputValue}
      autoFocus={false}
      inputMode="text"
      open={isFocused && filteredItems.length > 0}
      onChange={(e) => {
        e.preventDefault();
        const selectValue = (e.target as HTMLInputElement).value;
        if (selectValue) {
          setInputValue(stripNameFromId(stripRecentPrefix(selectValue)));
          handleValueChange(selectValue);
        }
      }}
      onMouseDown={(e) => e.currentTarget.focus()}
    >
      {/* sometimes unreliable */}
      {filteredItems.map((item, index) =>
        item.name && (
          <VscodeOption
            value={`recent#${item.id}`}
            key={item.id}
            className="url-select-option"
            // onKeyDown={(e) => {
            //   if (
            //     e.key === "ArrowUp" &&
            //     index === 0 // Check if it's the first element
            //   ) {
            //     e.preventDefault();
            //     const input = document.querySelector<HTMLInputElement>(".url-select-input");
            //     if (input) {
            //       input.focus(); // Focus back on the input field
            //     }
            //   }
            // }}
          >
            {item.name}
          </VscodeOption>
        )
      )}
    </VscodeSingleSelect>
  </span>


    // input w/o dropdown
    // <VscodeTextfield
    //   value={stripNameFromId(value)}
    //   onSubmit={(e) => {
    //     // @ts-ignore it works, types seem to be incorrect here
    //     onValueChange(e.target.value);
    //     setIsFocused(false);
    //   }}
    //   onFocus={() => {
    //     setIsFocused(true);
    //   }}
    //   placeholder="Enter URL"
    //   aria-label={value}
    //   className="url-select-trigger"
    //   onKeyDown={(e) => {
    //     if (e.key === "Enter") {
    //       e.preventDefault();
    //       const inputValue = (e.target as HTMLInputElement).value;
    //       if (inputValue) {
    //         handleValueChange(inputValue);
    //       }
    //     }
    //   }}
    // />


    // separate input and dropdown
    // <Select.Root
    //   onValueChange={handleValueChange}
    //   value={value}
    //   disabled={disabled}
    //   open={isFocused}
    // >
    //   <VscodeTextfield
    //     type="text"
    //     value={inputValue}
    //     onChange={(e) => setInputValue((e.target as HTMLInputElement).value)}
    //     onKeyDown={(e) => {
    //       if (e.key === "Enter") {
    //         e.preventDefault();
    //         const inputValue = (e.target as HTMLInputElement).value;
    //         if (inputValue) {
    //           handleValueChange(inputValue);
    //         }
    //       }
    //     }}
    //     // onBlur={() => setIsFocused(false)}
    //     onFocus={() => {
    //       setIsFocused(true);
    //     }}
    //     placeholder="Enter URL"
    //     className="url-select-input"
    //   />
    //   <Select.Trigger className="url-select-trigger">
    //     <Select.Value>
    //       <div className="url-select-value">
    //         {stripNameFromId(value)}
    //       </div>
    //     </Select.Value>
    //   </Select.Trigger>
    //   <Select.Portal>
    //     <Select.Content className="url-select-content" position="popper" autoFocus={false}>
    //       <Select.ScrollUpButton className="url-select-scroll">
    //         <span className="codicon codicon-chevron-up" />
    //       </Select.ScrollUpButton>
    //       <Select.Viewport className="url-select-viewport">
    //         <Select.Group>
    //           <Select.Label className="url-select-label">Suggested paths:</Select.Label>
    //           {recentItems
    //             .filter((item) => item.name.includes(inputValue))
    //             .map(
    //               (item) =>
    //                 item.name && (
    //                   <SelectItem value={`recent#${item.id}`} key={item.id}>
    //                     {item.name}
    //                   </SelectItem>
    //                 )
    //             )}
    //         </Select.Group>
    //         <Select.Separator className="url-select-separator" />
    //         <Select.Group>
    //           <Select.Label className="url-select-label">All visited paths:</Select.Label>
    //           {items.map(
    //             (item) =>
    //               item.name && (
    //                 <SelectItem value={item.id} key={item.id}>
    //                   {item.name}
    //                 </SelectItem>
    //               )
    //             )}
    //         </Select.Group>
    //       </Select.Viewport>
    //       <Select.ScrollDownButton className="url-select-scroll">
    //         <span className="codicon codicon-chevron-down" />
    //       </Select.ScrollDownButton>
    //     </Select.Content>
    //   </Select.Portal>
    // </Select.Root>


    // // select with search
    // <VscodeSingleSelect 
    //   combobox
    //   value={inputValue}
    //   inputMode="text"
    //   onInput={(e) => {
    //   e.preventDefault();
    //     const newValue = (e.target as HTMLInputElement).value;
    //     setInputValue(newValue); // Update the state with the input value
    //   }}
    //   onChange={(e) => {
    //     e.preventDefault();
    //     const newValue = (e.target as HTMLInputElement).value;
    //     setInputValue(newValue); // Update the state with the input value
    //     handleValueChange(newValue); // Handle the value change
    //   }}
    //   onKeyDown={(e) => {
    //   if (e.key === "Enter") {
    //     e.preventDefault();
    //     if (inputValue) {
    //     handleValueChange(inputValue); // Use the state value when Enter is pressed
    //     }
    //   }
    //   }}
    // >
    //   {recentItems.map(
    //   (item) =>
    //     item.name && (
    //     <VscodeOption value={`recent#${item.id}`} key={item.id}>
    //       {item.name}
    //     </VscodeOption>
    //     )
    //   )}
    //   <VscodeOption value="/testoage{}">{"test bad path"}</VscodeOption>
    // </VscodeSingleSelect>
  );
}

export default UrlSelect;
