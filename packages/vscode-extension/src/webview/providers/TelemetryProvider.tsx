import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { useUtils } from "./UtilsProvider";

type TelemetryContextProps = { telemetryEnabled: boolean };

const TelemetryContext = createContext<TelemetryContextProps>({ telemetryEnabled: false });

export function TelemetryProvider({ children }: PropsWithChildren) {
  const utils = useUtils();
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);

  useEffect(() => {
    utils.isTelemetryEnabled().then(setTelemetryEnabled);
    utils.addListener("telemetryEnabledChanged", setTelemetryEnabled);

    return () => {
      utils.removeListener("telemetryEnabledChanged", setTelemetryEnabled);
    };
  }, []);

  return (
    <TelemetryContext.Provider value={{ telemetryEnabled }}>{children}</TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);

  if (context === undefined) {
    throw new Error("useTelemetry must be used within a TelemetryContextProvider");
  }
  return context;
}
