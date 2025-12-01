import { useEffect, useMemo, useState } from "react";
import Button from "../components/shared/Button";
import { useModal } from "../providers/ModalProvider";
import { useProject } from "../providers/ProjectProvider";
import { VscodeCheckbox } from "@vscode-elements/react-elements";
import "./OpenDeepLinkView.css";
import "./ExportLogsView.css";

function ExportLogsView() {
  const { closeModal } = useModal();
  const { project } = useProject();

  const [allLogs, setAllLogs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchLogs() {
      const logs = await project.getLogFileNames();
      setAllLogs(logs);
      setSelected(Object.fromEntries(logs.map((name) => [name, true])));
    }
    fetchLogs();
  }, [project]);

  const selectedFiles = useMemo(
    () => allLogs.filter((name) => selected[name]),
    [allLogs, selected]
  );

  function toggle(name: string) {
    setSelected((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  async function onExport() {
    try {
      await project.buildDiagnosticsReport(selectedFiles);
    } finally {
      closeModal();
    }
  }

  return (
    <form className="container" data-testid="export-logs-view" onSubmit={(e) => e.preventDefault()}>
      <p className="export-logs-intro">Select which logs to include in the export.</p>

      <div className="export-logs-box" role="group" aria-label="Select logs to export">
        <div className="export-logs-list">
          {allLogs.map((name) => (
            <div className="checkbox-container" key={name}>
              <VscodeCheckbox
                checked={!!selected[name]}
                onClick={() => toggle(name)}
                label={name}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="feedback-row">
        <Button type="secondary" onClick={closeModal}>
          Cancel
        </Button>
        <Button type="ternary" disabled={selectedFiles.length === 0} onClick={onExport}>
          Export
        </Button>
      </div>
    </form>
  );
}

export default ExportLogsView;
