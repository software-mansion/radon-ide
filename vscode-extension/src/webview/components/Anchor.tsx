import { vscode } from "../utilities/vscode";

interface AnchorProps {
  url?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function Anchor({ url, children, onClick }: AnchorProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    vscode.postMessage({
      command: "openExternalUrl",
      url,
    });
  };

  return (
    <a href="#" onClick={onClick ?? handleClick}>
      {children}
    </a>
  );
}

export default Anchor;
