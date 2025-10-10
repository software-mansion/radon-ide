import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { HighlighterCore } from "shiki";
import { ThemeData } from "../../common/theme";
import { getHighlighter } from "../utils/highlighter";

/**
 * Simple hash function for generating cache keys from content
 */
function getHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

enum CacheEntryState {
  Done = "done",
  PendingRequest = "pendingRequest",
}

interface CacheEntry {
  state: CacheEntryState;
  html?: string;
  promise?: Promise<string>;
}

interface HighlighterContextValue {
  getHighlightedCode: (
    content: string,
    language: string,
    theme: ThemeData | undefined,
    requestId: string | number
  ) => Promise<string>;
  isCodeCached: (
    content: string,
    language: string,
    theme: ThemeData | undefined,
    requestId: string | number
  ) => boolean;
}

const HighlighterContext = createContext<HighlighterContextValue | null>(null);

export default function HighlighterProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const highlighterPromiseRef = useRef<Promise<HighlighterCore>>(getHighlighter());

  const generateCacheKey = (
    language: string,
    theme: ThemeData | undefined,
    content: string,
    requestId: string | number
  ) => {
    const contentHash = getHash(content);
    const themeName = theme?.name || "none";
    return `${language}:${themeName}:${requestId}:${contentHash}`;
  };

  const isCodeCached = (
    content: string,
    language: string,
    theme: ThemeData | undefined,
    requestId: string | number
  ) => {
    const cacheKey = generateCacheKey(language, theme, content, requestId);
    return cacheRef.current.has(cacheKey);
  };

  const getHighlightedCode = async (
    content: string,
    language: string,
    theme: ThemeData | undefined,
    requestId: string | number
  ): Promise<string> => {
    const cacheKey = generateCacheKey(language, theme, content, requestId);
    const entry = cacheRef.current.get(cacheKey);

    if (entry?.state === CacheEntryState.Done && entry.html) {
      return entry.html;
    }

    if (entry?.state === CacheEntryState.PendingRequest && entry.promise) {
      return entry.promise;
    }

    const highlightPromise = highlighterPromiseRef.current
      .then((highlighter) => {
        if (!highlighter) {
          cacheRef.current.delete(cacheKey);
          return "";
        }

        const code = highlighter.codeToHtml(content, {
          lang: language,
          theme: (theme as unknown) || "none",
        });
        const cacheEntry = {
          state: CacheEntryState.Done,
          html: code ?? "",
        };

        cacheRef.current.set(cacheKey, cacheEntry);
        return code ?? "";
      })
      .catch((error) => {
        console.error("Failed to highlight code:", error);
        cacheRef.current.delete(cacheKey);
        return "";
      });

    const cacheEntry = {
      state: CacheEntryState.PendingRequest,
      promise: highlightPromise,
    };

    cacheRef.current.set(cacheKey, cacheEntry);

    return highlightPromise;
  };

  const contextValue: HighlighterContextValue = {
    getHighlightedCode,
    isCodeCached,
  };

  useEffect(() => {
    return () => {
      cacheRef.current.clear();
    };
  }, []);

  return <HighlighterContext.Provider value={contextValue}>{children}</HighlighterContext.Provider>;
}

/**
 * Hook to access the highlighter
 * @throws Error if used outside of HighlighterContextProvider
 */
export function useHighlighter(): HighlighterContextValue {
  const context = useContext(HighlighterContext);
  if (!context) {
    throw new Error("useHighlighter must be used within HighlighterProvider");
  }
  return context;
}
