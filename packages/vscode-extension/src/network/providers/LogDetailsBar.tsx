import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

interface LogDetailsBarContextValue {
  isVisible: boolean;
  content: React.ReactNode;
  infoBarHeight: number;
  setContent: (content: React.ReactNode) => void;
  setIsVisible: (isVisible: boolean) => void;
  setInfoBarHeight: (height: number) => void;
}

const LogDetailsBarContext = createContext<LogDetailsBarContextValue | undefined>(undefined);

export default function LogDetailsBarProvider({ children }: PropsWithChildren) {
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [infoBarHeight, setInfoBarHeight] = useState(0);

  const contextValue = useMemo(
    () => ({
      isVisible,
      content,
      infoBarHeight,
      setContent,
      setIsVisible,
      setInfoBarHeight,
    }),
    [isVisible, content, infoBarHeight]
  );

  return (
    <LogDetailsBarContext.Provider value={contextValue}>{children}</LogDetailsBarContext.Provider>
  );
}

export function useLogDetailsBar() {
  const context = useContext(LogDetailsBarContext);

  if (!context) {
    throw new Error("useLogDetailsBar must be used within a LogDetailsBarProvider");
  }

  return context;
}
