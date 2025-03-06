import { useState } from "react";
import { Input } from "./shared/Input";
import Button from "./shared/Button";
import NetworkFiltersDropdown from "./NetworkFiltersDropdown";

const NetworkFilters = () => {
  const [value, setValue] = useState<string>("");
  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };
  return (
    <>
      <Input value={value} type="string" onChange={onChange} placeholder="Filter" />
      {/* <NetworkFiltersDropdown>
        <button style={{ alignItems: "center", display: "flex", gap: "4px" }}>
          More filters
          <span className="codicon codicon-triangle-down" />
        </button>
      </NetworkFiltersDropdown> */}
      <Button type="secondary">All</Button>
      <Button type="secondary">Fetch/XHR</Button>
      <Button type="secondary">Doc</Button>
      <Button type="secondary">CSS</Button>
      <Button type="secondary">JS</Button>
      <Button type="secondary">Font</Button>
      <Button type="secondary">Img</Button>
      <Button type="secondary">Media</Button>
      <Button type="secondary">Manifest</Button>
      <Button type="secondary">WS</Button>
      <Button type="secondary">Wasm</Button>
      <Button type="secondary">Other</Button>
    </>
  );
};

export default NetworkFilters;
