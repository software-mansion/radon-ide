import path from "path";
import { MultimediaData } from "../common/State";
import { saveFile } from "./saveFile";

export async function saveMultimedia(
  multimediaData: MultimediaData,
  defaultSavingLocation?: string
) {
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

  return savedUri !== undefined;
}
