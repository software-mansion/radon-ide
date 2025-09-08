import IconButton from "../../webview/components/shared/IconButton";

interface TabActionButtonsProps {
  data: string;
  copyDisabled?: boolean;
  additionalButtons?: React.ReactNode;
}

const TabActionButtons = ({ data, copyDisabled = false, additionalButtons }: TabActionButtonsProps) => {
  return (
    <div className="response-tab-button-wrapper">
      {additionalButtons}
      <IconButton
        className="response-tab-copy-button"
        tooltip={{ label: "Copy to Clipboard", side: "bottom" }}
        onClick={() => navigator.clipboard.writeText(data)}
        disabled={copyDisabled}>
        <span className="codicon codicon-copy" />
      </IconButton>
    </div>
  );
};

export default TabActionButtons;
