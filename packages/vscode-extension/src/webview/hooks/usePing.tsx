import { useEffect, useState, useRef } from "react";

const PING_DURATION = 300; // ms

export function usePing(counter: number, counterMode: "full" | "compact") {
  const [shouldPing, setShouldPing] = useState(false);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (counterMode !== "compact") {
      return;
    }

    if (counter !== 0) {
      // Check if animation is already running and don't start a new one
      if (!pingTimeoutRef.current) {
        setShouldPing(true);
        pingTimeoutRef.current = setTimeout(() => {
          setShouldPing(false);
          pingTimeoutRef.current = null;
        }, PING_DURATION);
      }
    } else {
      // Reset animation state when counter goes to 0
      if (pingTimeoutRef.current) {
        clearTimeout(pingTimeoutRef.current);
        pingTimeoutRef.current = null;
      }
      setShouldPing(false);
    }
  }, [counter, counterMode]);

  return shouldPing;
}
