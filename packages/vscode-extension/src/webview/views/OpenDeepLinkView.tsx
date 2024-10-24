import { useEffect, useState } from "react";
import { useProject } from "../providers/ProjectProvider";
import { useModal } from "../providers/ModalProvider";
import { SearchSelect } from "../components/shared/SearchSelect";

// TODO:
// 1. FOCUS ON THE INPUT EVERY TIME ACTION IS DONE.
// 2. EXPORT TO REUSABLE COMPONENT AND USE IN LOCALIZATION MODAL.

export const OpenDeepLinkView = () => {
  const { project } = useProject();
  const { closeModal } = useModal();

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
    <SearchSelect
      label="URL"
      buttonText="Open"
      searchPlaceholder="Input Deep Link"
      options={history}
      onSubmit={openDeepLink}
    />
  );
};
