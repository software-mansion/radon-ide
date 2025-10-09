import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from "react";
import { HighlighterCore } from "shiki";
import { ThemeData } from "../../common/theme";
import { getHighlighter } from "../utils/highlighter";

/**
 * Simple hash function for generating consistent cache keys from content
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Cache entry state
 */
type CacheEntryState = "loading" | "done" | "pendingRequest";

/**
 * Cache entry containing the HTML result and its state
 */
interface CacheEntry {
  state: CacheEntryState;
  html?: string;
  promise?: Promise<string>;
}

/**
 * Interface for the highlight cache context
 */
interface HighlightCacheContextValue {
  generateCacheKey: (language: string, theme: ThemeData | undefined, content: string) => string;
  getCachedHtml: (key: string) => string | undefined;
  setCachedHtml: (key: string, html: string) => void;
  clearCache: () => void;
  getCacheSize: () => number;
  getHighlightedCode: (
    content: string,
    language: string,
    theme: ThemeData | undefined
  ) => Promise<string>;
  isCodeLoading: (requestId: string) => boolean;
}

/**
 * Context for accessing the code highlighting methods
 */
const HighlightCacheContext = createContext<HighlightCacheContextValue | null>(null);

/**
 * Provider component for the highlight cache
 * Uses a ref to store a single Map with cache entries containing state and data
 */
export default function HighlightCacheProvider({ children }: { children: ReactNode }) {
  // Single Map to store cache entries with state
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const highlighterRef = useRef<HighlighterCore | null>(null);

  useEffect(() => {
    getHighlighter().then((highlighter) => {
      highlighterRef.current = highlighter;
    });
  }, []);

  const generateCacheKey = useCallback(
    (language: string, theme: ThemeData | undefined, content: string) => {
      const contentHash = simpleHash(content);
      const themeName = theme?.name || "none";
      return `${language}::${themeName}::${contentHash}`;
    },
    []
  );

  const getHighlightedCode = useCallback(
    async (content: string, language: string, theme: ThemeData | undefined): Promise<string> => {
      const cacheKey = generateCacheKey(language, theme, content);
      const entry = cacheRef.current.get(cacheKey);

      if (entry?.state === "done" && entry.html) {
        return entry.html;
      }

      if (entry?.state === "pendingRequest" && entry.promise) {
        return entry.promise;
      }

      cacheRef.current.set(cacheKey, { state: "loading" });

      const code = highlighterRef.current?.codeToHtml(content, {
        lang: language,
        theme: (theme as unknown) || "none",
      });

      return code || "";
    },
    [generateCacheKey]
  );

  const contextValue: HighlightCacheContextValue = {
    generateCacheKey,

    getCachedHtml: (key: string) => {
      const entry = cacheRef.current.get(key);
      return entry?.state === "done" ? entry.html : undefined;
    },

    setCachedHtml: (key: string, html: string) => {
      cacheRef.current.set(key, {
        state: "done",
        html,
      });
    },

    clearCache: () => {
      cacheRef.current.clear();
    },

    getCacheSize: () => {
      return cacheRef.current.size;
    },

    getHighlightedCode,

    isCodeLoading: (requestId: string) => {
      const entry = cacheRef.current.get(requestId);
      return entry?.state === "loading" || entry?.state === "pendingRequest";
    },
  };

  useEffect(() => {
    // Clear cache when the provider (network inspector) is unmounted
    return () => {
      cacheRef.current.clear();
    };
  }, []);

  return (
    <HighlightCacheContext.Provider value={contextValue}>{children}</HighlightCacheContext.Provider>
  );
}

/**
 * Hook to access the highlight cache
 * @throws Error if used outside of HighlightCacheProvider
 */
export function useHighlightCache(): HighlightCacheContextValue {
  const context = useContext(HighlightCacheContext);
  if (!context) {
    throw new Error("useHighlightCache must be used within HighlightCacheProvider");
  }
  return context;
}
