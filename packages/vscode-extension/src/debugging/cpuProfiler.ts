import path from "path";
import os from "os";
import { Source } from "@vscode/debugadapter";
import { CDPCallFrame, CDPProfile } from "./cdp";
import { SourceMapsRegistry } from "./SourceMapsRegistry";

type FrameKey = string;

type DAPAnnotationLocation = {
  callFrame: CDPCallFrame;
  locations: DAPSourceLocation[];
};

type DAPSourceLocation = {
  lineNumber: number;
  columnNumber: number;
  source: Source;
  relativePath?: string;
};

function callFrameKey(callFrame: CDPCallFrame): FrameKey {
  return [callFrame.scriptId, callFrame.lineNumber, callFrame.columnNumber].join(":") as FrameKey;
}

/**
 * Returns the file path the profile file should be saved to.
 */
export function filePathForProfile() {
  const fileName = `profile-${Date.now()}.cpuprofile`;
  const filePath = path.join(os.tmpdir(), fileName);
  return filePath;
}

/**
 * Expands the providing CPU Profile data with VSCode specific fields that
 * are used by the VSCode CPU Profile Visualizer extension. The additional fields
 * are used to provide the original source location for each node in the profile.
 */
export function annotateLocations(profile: CDPProfile, sourceMapsRegistry: SourceMapsRegistry) {
  let locationIdCounter = 0;
  const locationIds = new Map<FrameKey, number>();
  const locations: DAPAnnotationLocation[] = [];

  const nodes = profile.nodes.map((node) => {
    const key = callFrameKey(node.callFrame);
    let locationId = locationIds.get(key);

    if (!locationId) {
      locationId = locationIdCounter++;
      locationIds.set(key, locationId);

      const origPosition = sourceMapsRegistry.findOriginalPosition(
        // Apparently, hermes seems to report a different scriptId here – for a fresh app that just started,
        // we get scriptId "2" for the main bundle, but in profile node's callFrame, "0" is reported.
        // for this reasone, we rely on the script URL rather than scriptIde here, but we should revisit this
        // to investigate if this is a bug in hermes or something that can be addressed.
        node.callFrame.url,
        node.callFrame.lineNumber + 1,
        node.callFrame.columnNumber
      );

      if (origPosition.sourceURL !== "__source__") {
        // TODO: we should find a better way to communicate that the source location cannot be resolved
        locations.push({
          callFrame: node.callFrame,
          locations: [
            {
              lineNumber: origPosition.lineNumber1Based - 1,
              columnNumber: origPosition.columnNumber0Based,
              source: new Source(origPosition.sourceURL, origPosition.sourceURL),
            },
          ],
        });
      } else {
        locations.push({
          callFrame: node.callFrame,
          locations: [],
        });
      }
    }
    return {
      ...node,
      locationId, // VScode specific field: https://github.com/microsoft/vscode-js-profile-visualizer/blob/main/packages/vscode-js-profile-core/src/cpu/types.ts#L12
    };
  });

  return {
    ...profile,
    nodes,
    $vscode: {
      // VSCode especific fields: https://github.com/microsoft/vscode-js-profile-visualizer/blob/main/packages/vscode-js-profile-core/src/cpu/types.ts#L20
      locations: locations,
    },
  };
}
