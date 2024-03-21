import { useEffect } from "react";

import { useAlert } from "../providers/AlertProvider";
import { useModal } from "../providers/ModalProvider";
import { useDependencies } from "../providers/DependenciesProvider";
import { useProject } from "../providers/ProjectProvider";

import IconButton from "../components/shared/IconButton";
import DiagnosticView from "../views/DiagnosticView";
import DoctorIcon from "../components/icons/DoctorIcon";

function Actions() {
  const { project } = useProject();
  const { openModal } = useModal();
  return (
    <>
      <IconButton
        type="secondary"
        onClick={() => {
          openModal("Diagnostics", <DiagnosticView />);
        }}
        tooltip={{ label: "Run diagnostics", side: "bottom" }}>
        <DoctorIcon />
      </IconButton>
      <IconButton
        type="secondary"
        onClick={() => {
          project.restart(false);
        }}
        tooltip={{ label: "Reload IDE", side: "bottom" }}>
        <span className="codicon codicon-refresh" />
      </IconButton>
    </>
  );
}

const id = "diagnostic-alert";

export function useDiagnosticAlert() {
  const { openAlert, isOpen, closeAlert } = useAlert();
  const { isError } = useDependencies();

  useEffect(() => {
    if (isError && !isOpen(id)) {
      openAlert({
        id,
        title: "Cannot run project",
        description: "Run diagnostics to find out what went wrong.",
        actions: <Actions />,
      });
    } else if (!isError && isOpen(id)) {
      closeAlert(id);
    }
  }, [isError, isOpen, openAlert, closeAlert, id]);
}
