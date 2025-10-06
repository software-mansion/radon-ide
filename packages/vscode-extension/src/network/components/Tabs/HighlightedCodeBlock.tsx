import { useEffect, useState } from "react";
import { ShikiHighlighter } from "react-shiki/core";
import { getHighlighter } from "../../utils/highlighter";

import { ThemeData } from "../../../common/theme";
import "./PayloadAndResponseTab.css";

interface HighlightedCodeBlockProps {
  content: string | null | undefined;
  language?: string;
  theme?: ThemeData;
  placeholder?: string;
  className?: string;
}

/**
 * Maximum content length (in characters) to apply syntax highlighting
 * For larger content, plain text will be displayed to avoid performance issues
 */
const MAX_HIGHLIGHT_LENGTH = 100_000;
const HIGHLIGHT_THROTTLE = 100; // milliseconds

const HighlightedCodeBlock = ({
  content,
  language = "plaintext",
  theme,
  placeholder = "No content",
  className = "response-tab-pre",
}: HighlightedCodeBlockProps) => {
  const [highlighter, setHighlighter] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const contentLength = content?.length ?? 0;
  const shouldHighlight = contentLength <= MAX_HIGHLIGHT_LENGTH;
  const isPlainText = language === "plaintext";

  const shouldShowNoHighlightInfo = !isLoading && !isPlainText && !shouldHighlight;
  const shouldShowPlaintext = isLoading || !highlighter || !shouldHighlight;

  useEffect(() => {
    // Only initialize highlighter if content should be highlighted
    if (!shouldHighlight) {
      setIsLoading(false);
      return;
    }

    getHighlighter()
      .then((instance) => {
        setHighlighter(instance);
      })
      .catch((error) => {
        console.error("Failed to initialize highlighter:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [shouldHighlight]);

  // Show plain text while loading or if content is too large
  if (shouldShowPlaintext) {
    return (
      <>
        {shouldShowNoHighlightInfo && (
          <pre className="no-highlight-info">
            <span className="codicon codicon-info" /> Content too large for syntax highlighting.
          </pre>
        )}
        <pre className={className}>{content ?? placeholder}</pre>
      </>
    );
  }

  return (
    <ShikiHighlighter
      theme={(theme as unknown) ?? "none"}
      // @ts-expect-error - Type compatibility issue with HighlighterCore for some reason
      highlighter={highlighter}
      language={language}
      showLanguage={false}
      addDefaultStyles={false}
      delay={HIGHLIGHT_THROTTLE}
      className={className}>
      {content ?? placeholder}
    </ShikiHighlighter>
  );
};

export default HighlightedCodeBlock;
