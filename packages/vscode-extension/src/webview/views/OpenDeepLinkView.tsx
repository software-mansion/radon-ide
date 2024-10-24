import { useEffect, useState } from "react";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { SearchSelect } from "../components/shared/SearchSelect";
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
      // await new Promise<void>((res, rej) => setTimeout(() => res(), 5000));
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        openDeepLink(url);
      }}
    >
      <SearchSelect
        className="deep-link-search-select"
        searchPlaceholder="Input Deep Link"
        options={history ?? []}
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
