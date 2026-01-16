import path from "path";
import { CaptureResult, MultimediaData } from "../common/State";
import { saveFile } from "./saveFile";

export async function saveMultimedia(
  multimediaData: MultimediaData,
  defaultSavingLocation?: string
): Promise<CaptureResult> {
  const extension = path.extname(multimediaData.tempFileLocation);
  const baseFileName = multimediaData.fileName.substring(
    0,
    multimediaData.fileName.length - extension.length
  );

  const savedUri = await saveFile(multimediaData.tempFileLocation, {
    baseFileName,
    extension,
    defaultSavingLocation,
    filterLabel: "Video Files",
  });

  return savedUri !== undefined ? CaptureResult.Saved : CaptureResult.Canceled;
}
