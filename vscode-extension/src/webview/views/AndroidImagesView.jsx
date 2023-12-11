import { useCallback, useEffect, useMemo, useState } from "react";
import "./View.css";
import { vscode } from "../utilities/vscode";
import { VSCodeButton, VSCodeCheckbox, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import "./AndroidImagesView.css";
import EditAndroidDevice from "../components/EditAndroidDevice";
import { useGlobalStateContext } from "../components/GlobalStateContext";

function AndroidImagesView() {
  const [availableImages, setAvailableImages] = useState([]);
  const [installedImages, setInstalledImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagesProcessStream, setImagesProcessStream] = useState("");
  const [loading, setLoading] = useState(false);
  const { updateDevices, state: globalState } = useGlobalStateContext();

  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      switch (message.command) {
        case "allAndroidImagesListed":
          setAvailableImages(message.availableImages);
          setInstalledImages(message.installedImages);
          setSelectedImages(message.installedImages);
          break;
        case "installProcessFinished":
          setLoading(false);
          setAvailableImages(message.availableImages);
          setInstalledImages(message.installedImages);
          setSelectedImages(message.installedImages);
          setImagesProcessStream("");
          break;
        case "streamAndroidInstallationProgress":
          setImagesProcessStream(message.stream);
          break;
      }
    };

    window.addEventListener("message", listener);

    vscode.postMessage({
      command: "listAllAndroidImages",
    });

    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    const devices = globalState?.devices;
    if (!devices) return;
    const newDevices = devices.map((device) => {
      const isImageInstalled = !!installedImages.find(
        (installedImage) => installedImage.path === device?.systemImage?.path
      );
      return isImageInstalled ? device : { ...device, systemImage: null };
    });
    updateDevices(newDevices);
  }, [installedImages]);

  const isImageInstalled = useCallback(
    (image) => installedImages.find((installedImage) => installedImage.path === image.path),
    [installedImages]
  );

  const isImageChecked = useCallback(
    (image) => selectedImages.find((selectedImage) => selectedImage.path === image.path),
    [selectedImages]
  );

  const handleCheckImage = useCallback(
    (image) => {
      const wasImageChecked = !!selectedImages.find(
        (selectedImage) => selectedImage.path === image.path
      );
      if (wasImageChecked) {
        setSelectedImages((current) =>
          current.filter((selectedImage) => selectedImage.path !== image.path)
        );
      } else {
        setSelectedImages((current) => [...current, image]);
      }
    },
    [selectedImages]
  );

  const imagesToInstall = useMemo(
    () => selectedImages.filter((selectedImage) => !isImageInstalled(selectedImage)),
    [selectedImages, isImageInstalled]
  );

  const imagesToRemove = useMemo(
    () => installedImages.filter((installedImage) => !isImageChecked(installedImage)),
    [installedImages, isImageChecked]
  );

  const allImages = useMemo(
    () =>
      [...availableImages].sort((a, b) => {
        if (a.apiLevel > b.apiLevel) {
          return -1;
        }
        if (a.apiLevel < b.apiLevel) {
          return 1;
        }
        return 0;
      }),
    [availableImages, installedImages]
  );

  const handleInstall = useCallback(() => {
    setLoading(true);
    vscode.postMessage({
      command: "processAndroidImageChanges",
      toRemove: imagesToRemove,
      toInstall: imagesToInstall,
    });
  }, [imagesToInstall, imagesToRemove]);

  const renderIconForImage = (image) => {
    if (isImageChecked(image) && !isImageInstalled(image)) {
      return <span className="codicon codicon-cloud-download" />;
    }

    if (!isImageChecked(image) && isImageInstalled(image)) {
      return <span className="codicon codicon-trash" />;
    }
    return undefined;
  };

  const isInstallingDisabled = (!imagesToRemove.length && !imagesToInstall.length) || loading;

  return (
    <div className="panel-view">
      {!installedImages.length ? (
        <VSCodeProgressRing />
      ) : (
        <EditAndroidDevice installedAndroidImages={installedImages} className="section" />
      )}
      <div className="section">
        <VSCodeButton
          appearance="secondary"
          disabled={isInstallingDisabled}
          onClick={handleInstall}>
          {loading ? <VSCodeProgressRing /> : "Install/Uninstall"}
        </VSCodeButton>
      </div>
      <div className="section">
        {loading && !!imagesProcessStream.length && imagesProcessStream}
      </div>
      <table>
        <tr>
          <th></th>
          <th>Installed</th>
          <th>Api Level</th>
          <th>Description</th>
        </tr>
        {allImages.map((image) => (
          <tr key={image.path}>
            <td>{renderIconForImage(image)}</td>
            <td>
              <VSCodeCheckbox
                disabled={loading}
                checked={isImageChecked(image)}
                onClick={() => handleCheckImage(image)}
              />
            </td>
            <td>{image.apiLevel}</td>
            <td className="description">{image.description}</td>
          </tr>
        ))}
      </table>
    </div>
  );
}

export default AndroidImagesView;
