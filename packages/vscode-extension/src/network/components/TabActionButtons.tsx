import IconButton from "../../webview/components/shared/IconButton";

interface TabActionButtonsProps {
  data: string | undefined;
  disabled?: boolean;
  additionalButtons?: React.ReactNode;
}

const TabActionButtons = ({ data, disabled = false, additionalButtons }: TabActionButtonsProps) => {
  return (
    <div className="response-tab-button-wrapper">
      {additionalButtons}
      <IconButton
        className="response-tab-copy-button"
        tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
        onClick={() => data && navigator.clipboard.writeText(data)}
        disabled={disabled}>
        <span className="codicon codicon-copy" />
      </IconButton>
    </div>
  );
};

export default TabActionButtons;
