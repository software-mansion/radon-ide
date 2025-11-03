import { InspectedElementPayload, InspectElementFullData } from "react-devtools-inline";

export function isFullInspectionData(
  payload?: InspectedElementPayload
): payload is InspectElementFullData {
  return payload?.type === "full-data";
}
