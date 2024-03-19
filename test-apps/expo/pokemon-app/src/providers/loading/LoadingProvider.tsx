import { LoadingContext } from "../../contexts/loading/LoadingContext";
import React, { useContext, useState, ReactNode } from "react";
import ILoading from "../../ts/interfaces/loading/loading";

interface LoadingProviderProps {
  children: ReactNode;
}

const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [loading, setLoading] = useState<ILoading>({
    state: false,
  });

  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};

const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};

export { LoadingProvider, useLoading };
