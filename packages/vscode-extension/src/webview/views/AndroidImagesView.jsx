import { useCallback, useEffect, useMemo, useState } from "react";
import "./View.css";
import { VSCodeCheckbox, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import "./AndroidImagesView.css";

function AndroidImagesView() {
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    setSelectedImages(installedAndroidImages);
  }, [installedAndroidImages]);

  const isImageInstalled = useCallback(
    (image) => installedAndroidImages.find((installedImage) => installedImage.path === image.path),
    [installedAndroidImages]
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
    () => installedAndroidImages.filter((installedImage) => !isImageChecked(installedImage)),
    [installedAndroidImages, isImageChecked]
  );

  const allImagesSorted = useMemo(
    () =>
      [...availableAndroidImages].sort((a, b) => {
        if (a.apiLevel > b.apiLevel) {
          return -1;
        }
        if (a.apiLevel < b.apiLevel) {
          return 1;
        }
        return 0;
      }),
    [availableAndroidImages]
  );

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
      <div className="section">
        <Button
          type="secondary"
          disabled={isInstallingDisabled}
          onClick={() =>
            processAndroidImageChanges({ toInstall: imagesToInstall, toRemove: imagesToRemove })
          }>
          {loading ? <VSCodeProgressRing /> : "Install/Uninstall"}
        </Button>
      </div>
      <div className="section">
        {loading && !!androidInstallationOutputStream.length && androidInstallationOutputStream}
      </div>
      <table>
        <tr>
          <th></th>
          <th>Installed</th>
          <th>Api Level</th>
          <th>Description</th>
        </tr>
        {allImagesSorted.map((image) => (
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
