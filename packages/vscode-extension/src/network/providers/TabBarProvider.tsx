import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

interface TabBarContextValue {
  isVisible: boolean;
  content: React.ReactNode;
  height: number;
  setContent: (content: React.ReactNode) => void;
  setIsVisible: (isVisible: boolean) => void;
  setHeight: (height: number) => void;
}

const TabBarContext = createContext<TabBarContextValue | undefined>(undefined);

export default function TabBarProvider({ children }: PropsWithChildren) {
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [height, setHeight] = useState(0);

  const contextValue = useMemo(
    () => ({
      isVisible,
      content,
      height,
      setContent,
      setIsVisible,
      setHeight,
    }),
    [isVisible, content, height]
  );

  return <TabBarContext.Provider value={contextValue}>{children}</TabBarContext.Provider>;
}

export function useTabBar() {
  const context = useContext(TabBarContext);

  if (!context) {
    throw new Error("useTabBar must be used within a TabBarProvider");
  }

  return context;
}
