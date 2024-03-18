import { createContext, useContext } from "react";
import ILoading from "ts/interfaces/loading/loading";

type LoadingState = {
  loading: ILoading;
  setLoading: (loading: ILoading) => void;
};

const LoadingContext = createContext<LoadingState | null>(null);

const useLoading = (): LoadingState => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { LoadingContext, useLoading };
