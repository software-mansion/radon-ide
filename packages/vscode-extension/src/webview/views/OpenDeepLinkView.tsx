import { useEffect, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { SearchSelect } from "../components/shared/SearchSelect";
import Button from "../components/shared/Button";
import "./OpenDeepLinkView.css";
import { useDevices } from "../providers/DevicesProvider";

export const OpenDeepLinkView = () => {
  const { projectState, project } = useProject();
  const selectedDeviceId = projectState.selectedDevice;
  const { deviceSessionsManager } = useDevices();
  const { closeModal } = useModal();

  const [url, setUrl] = useState<string>("");
  const [history, setHistory] = useState<string[] | undefined>(undefined);
  const [terminateApp, setTerminateApp] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const historyFromCache = await project.getDeepLinksHistory();
      setHistory(historyFromCache);
    })();
  }, []);

  const openDeepLink = async (link: string) => {
    if (!link) {
      return;
    }
    closeModal();
    selectedDeviceId &&
      (await deviceSessionsManager.openDeepLink(selectedDeviceId, link, terminateApp));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        openDeepLink(url);
      }}>
      <SearchSelect
        className="deep-link-search-select"
        searchPlaceholder="Enter deep link or search history"
        optionsLabel="Recently used links"
        options={history ?? []}
        isLoading={history === undefined}
        onValueChange={setUrl}
      />
      <div className="checkbox-container">
        <Switch.Root
          className="switch-root small-switch"
          onCheckedChange={setTerminateApp}
          defaultChecked={terminateApp}>
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
        <label>Terminate app before sending deep link</label>
      </div>
      <div className="submit-button-container">
        <Button className="submit-button" type="secondary" onClick={() => openDeepLink(url)}>
          Open
        </Button>
      </div>
    </form>
  );
};
