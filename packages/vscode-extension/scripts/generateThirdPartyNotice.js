const fs = require("fs");
const path = require("path");

const directoryPath = "dist/third-party-licenses";
const outputFile = "dist/THIRDPARTYNOTICE.json";

function readJsonFiles() {
  return fs.promises.readdir(directoryPath, { withFileTypes: true }).then((entries) => {
    const filePromises = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => require(path.join("..", directoryPath, entry.name)));
    return Promise.all(filePromises);
  });
}

function mergeLibraries(dataArrays) {
  const mergedResults = [];

  dataArrays.forEach((data) => {
    data.third_party_libraries.forEach((library) => {
      if (
        !mergedResults.find(
          (lib) =>
            lib.package_name === library.package_name &&
            lib.package_version === library.package_version
        )
      ) {
        mergedResults.push(library);
      }
    });
  });

  return {
    root_name: "radon-ide",
    third_party_libraries: mergedResults,
  };
}

function writeMergedData(data) {
  const jsonData = JSON.stringify(data, null, 2); // pretty print with 2 spaces indention
  return fs.promises.writeFile(outputFile, jsonData, "utf8");
}

readJsonFiles()
  .then(mergeLibraries)
  .then(writeMergedData)
  .then(() => console.log("Finished writing merged third party libraries to:", outputFile))
  .catch((err) => console.error("Error processing files:", err));
