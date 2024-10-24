import { useEffect, useState } from "react";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { SearchSelect } from "../components/shared/SearchSelect";
import Label from "../components/shared/Label";
import Button from "../components/shared/Button";

// TODO:
// 2. EXPORT TO REUSABLE COMPONENT AND USE IN LOCALIZATION MODAL.

export const OpenDeepLinkView = () => {
  const { project } = useProject();
  const { closeModal } = useModal();

  const [url, setUrl] = useState<string>("");
  const [history, setHistory] = useState<string[] | undefined>(undefined);

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
    await project.openDeepLink(link);
  };

  // TODO: Better loading...
  if (history === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        openDeepLink(url);
      }}
    >
      <Label>URL</Label>
      <SearchSelect
        searchPlaceholder="Input Deep Link"
        options={history}
        isLoading={history === undefined}
        onValueChange={setUrl}
      />
      <div className="submit-button-container">
        <Button 
          className="submit-button" 
          type="secondary" 
          onClick={() => openDeepLink(url)}
        >
          Open
        </Button>
      </div>
    </form>
  );
};
