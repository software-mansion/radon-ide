import { vscode } from "../utilities/vscode";

function Anchor({ url, children }) {
  const handleClick = (e) => {
    e.preventDefault();
    vscode.postMessage({
      command: "openExternalUrl",
      url,
    });
  };

  return <a href="#" onClick={handleClick}>{children}</a>;
}

export default Anchor;
