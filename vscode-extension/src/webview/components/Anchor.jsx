import { vscode } from "../utilities/vscode";

function Anchor({ url, children, onClick }) {
  const handleClick = (e) => {
    e.preventDefault();
    vscode.postMessage({
      command: "openExternalUrl",
      url,
    });
  };

  return <a href="#" onClick={onClick ?? handleClick}>{children}</a>;
}

export default Anchor;
