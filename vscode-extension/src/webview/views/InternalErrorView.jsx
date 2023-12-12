import Anchor from "../components/Anchor";
import { vscode } from "../utilities/vscode";

function InternalErrorView() {
  console.log(vscode);
  return (
    <main>
      <h2>Internal Extension Error</h2>
      <p>
        For more details look into log file inside&nbsp;
        <Anchor
          onClick={() =>
            vscode.postMessage({
              command: "openLogsDirInFinder",
            })
          }>
          here
        </Anchor>
        .
      </p>
    </main>
  );
}

export default InternalErrorView;
