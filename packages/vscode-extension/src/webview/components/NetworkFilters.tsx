import { Input } from "./shared/Input";
import { useNetwork } from "../providers/NetworkProvider";

const NetworkFilters = () => {
  const { setFilters, filters } = useNetwork();
  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, url: event.target.value });
  };

  return (
    <>
      <Input value={filters.url ?? ""} type="string" onChange={onChange} placeholder="Filter" />
    </>
  );
};

export default NetworkFilters;
