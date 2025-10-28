import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

interface TabBarContextValue {
  content: React.ReactNode;
  setContent: (content: React.ReactNode) => void;
}

const TabBarContext = createContext<TabBarContextValue | undefined>(undefined);

export default function TabBarProvider({ children }: PropsWithChildren) {
  const [content, setContent] = useState<React.ReactNode>(null);

  const contextValue = useMemo(
    () => ({
      content,
      setContent,
    }),
    [content]
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
