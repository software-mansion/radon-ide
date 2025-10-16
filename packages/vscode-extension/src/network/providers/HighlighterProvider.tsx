import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { HighlighterCore } from "shiki";
import { ThemeData } from "../../common/theme";
import { getHighlighter } from "../utils/highlighter";

enum CacheEntryState {
  Done = "done",
  PendingRequest = "pendingRequest",
}

interface CacheEntry {
  state: CacheEntryState;
  html?: string;
  promise?: Promise<string>;
  size: number; // Track the size of the cached content
  accessTime: number; // Track when the entry was last accessed
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
  ) => Promise<boolean>;
}

const encoder = new TextEncoder();

/**
 * Generate SHA-1 hash for cache key from content string
 */
async function getHash(str: string): Promise<string> {
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const HighlighterContext = createContext<HighlighterContextValue | null>(null);
/**
 * Cache size limit in characters (after the html colouring is applied)
 */
const MAX_CACHE_SIZE = 5_000_000;
/**
 * Minimum size for a text block to be cached (before the html colouring is applied)
 */
const MINIMUM_SIZE_TO_CACHE = 20_000;

export default function HighlighterProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const cacheSizeRef = useRef<number>(0); // Track total cache size
  const highlighterPromiseRef = useRef<Promise<HighlighterCore>>(getHighlighter());

  /**
   * Evict oldest entries from cache until size is under the limit
   */
  const evictOldestEntries = (requiredSpace: number) => {
    const cache = cacheRef.current;
    const entries = Array.from(cache.entries()).sort(([, a], [, b]) => a.accessTime - b.accessTime);

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (cacheSizeRef.current - freedSpace + requiredSpace <= MAX_CACHE_SIZE) {
        break;
      }

      cache.delete(key);
      freedSpace += entry.size;
    }

    cacheSizeRef.current -= freedSpace;
  };

  const generateCacheKey = async (
    language: string,
    theme: ThemeData | undefined,
    content: string,
    requestId: string | number
  ) => {
    const contentHash = await getHash(content);
    const themeName = theme?.name || "none";
    return `${language}:${themeName}:${requestId}:${contentHash}`;
  };

  const isCodeCached = async (
    content: string,
    language: string,
    theme: ThemeData | undefined,
    requestId: string | number
  ) => {
    const cacheKey = await generateCacheKey(language, theme, content, requestId);
    return cacheRef.current.has(cacheKey);
  };

  const getHighlightedCode = async (
    content: string,
    language: string,
    theme: ThemeData | undefined,
    requestId: string | number
  ): Promise<string> => {
    const cacheKey = await generateCacheKey(language, theme, content, requestId);
    const entry = cacheRef.current.get(cacheKey);
    const shouldCache = content.length >= MINIMUM_SIZE_TO_CACHE;

    if (entry?.state === CacheEntryState.Done && entry.html) {
      entry.accessTime = Date.now();
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

        const highlightResult = highlighter.codeToHtml(content, {
          lang: language,
          theme: (theme as unknown) || "none",
        });
        const code = highlightResult || "";
        const totalSize = code.length;

        if (!shouldCache) {
          return code;
        }

        // Check if we need to evict old entries
        if (cacheSizeRef.current + totalSize > MAX_CACHE_SIZE) {
          evictOldestEntries(totalSize);
        }

        const cacheEntry: CacheEntry = {
          state: CacheEntryState.Done,
          html: code ?? "",
          size: totalSize,
          accessTime: Date.now(),
        };

        cacheRef.current.set(cacheKey, cacheEntry);
        cacheSizeRef.current += totalSize;
        return code;
      })
      .catch((error) => {
        console.error("Failed to highlight code:", error);
        const existingEntry = cacheRef.current.get(cacheKey);
        if (existingEntry) {
          cacheSizeRef.current -= existingEntry.size;
        }
        cacheRef.current.delete(cacheKey);
        return "";
      });

    const estimatedSize = content.length;
    const pendingEntry: CacheEntry = {
      state: CacheEntryState.PendingRequest,
      promise: highlightPromise,
      size: estimatedSize,
      accessTime: Date.now(),
    };

    cacheRef.current.set(cacheKey, pendingEntry);
    cacheSizeRef.current += estimatedSize;

    return highlightPromise;
  };

  const contextValue: HighlighterContextValue = {
    getHighlightedCode,
    isCodeCached,
  };

  useEffect(() => {
    return () => {
      cacheRef.current.clear();
      cacheSizeRef.current = 0;
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
