import ShikiHighlighter, { Theme } from "react-shiki";
import { ThemeData } from "../../../common/theme";
import "./PayloadAndResponseTab.css";

interface HighlightedCodeBlockProps {
  content: string | null | undefined;
  language?: string;
  theme?: ThemeData;
  placeholder?: string;
  className?: string;
}

const HighlightedCodeBlock = ({
  content,
  language = "plaintext",
  theme,
  placeholder = "No content",
  className = "response-tab-pre",
}: HighlightedCodeBlockProps) => {
  return (
    <ShikiHighlighter
      theme={theme as Theme ?? "none"}
      language={language}
      showLanguage={false}
      addDefaultStyles={false}
      className={className}>
      {content ?? placeholder}
    </ShikiHighlighter>
  );
};

export default HighlightedCodeBlock;