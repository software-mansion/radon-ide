import fs from "fs";

// Usage: node mergeThirdPartyNotices.js file1.json file2.json file3.json output.json
const inputFileNames = process.argv.slice(2, -1);
const outputFileName = process.argv[process.argv.length - 1];

const UNACCEPTABLE_LICENSES = ["GPL", "AGPL", "LGPL", "NGPL"];

function readInputs() {
  return Promise.resolve(inputFileNames.map((fileName) => JSON.parse(fs.readFileSync(fileName))));
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
  return fs.promises.writeFile(outputFileName, jsonData, "utf8");
}

function verifyLicenses(data) {
  const licenses = new Set();
  // collect all license names
  data.third_party_libraries.forEach((library) => {
    library.licenses.forEach((license) => licenses.add(license.license));
  });

  // verify whether some of the licenses contain unacceptable license names
  const unacceptableLicenses = Array.from(licenses).filter((license) =>
    UNACCEPTABLE_LICENSES.some((unacceptableLicense) => license.includes(unacceptableLicense))
  );
  if (unacceptableLicenses.length > 0) {
    console.error("Found unacceptable licenses:", unacceptableLicenses);
    process.exit(1);
  }

  console.log("Licenses used:", Array.from(licenses).join(", "));
  return data;
}

readInputs()
  .then(mergeLibraries)
  .then(verifyLicenses)
  .then(writeMergedData)
  .then(() => console.log("Finished writing merged third party libraries to:", outputFileName))
  .catch((err) => console.error("Error processing files:", err));
