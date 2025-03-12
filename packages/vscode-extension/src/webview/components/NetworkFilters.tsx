import { useState } from "react";
import { Input } from "./shared/Input";
import Button from "./shared/Button";
import { useNetwork } from "../providers/NetworkProvider";
enum RequestType {
  All = "all",
  XHR = "xhr",
  Image = "image",
  Script = "script",
  CSS = "css",
  Font = "font",
  Media = "media",
  Manifest = "manifest",
  WebSocket = "ws",
  WebAssembly = "wasm",
  Other = "other",
}

const NetworkFilters = () => {
  const [value, setValue] = useState<string>("");
  const { setFilters, filters } = useNetwork();
  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const renderButton = (type: RequestType) => {
    return (
      <Button
        active={filters.requestType === type}
        type="secondary"
        onClick={() => setFilters({ requestType: type })}>
        {type}
      </Button>
    );
  };
  return (
    <>
      <Input value={value} type="string" onChange={onChange} placeholder="Filter" />
    </>
  );
};

export default NetworkFilters;
