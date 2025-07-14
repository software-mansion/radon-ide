import React from "react";
import { createComponent } from "@lit/react";
import { VscodeToolbarButton as WC } from "@vscode-elements/elements/dist/vscode-toolbar-button/vscode-toolbar-button.js";

/**
 * This component is a wrapper for the vscode-toolbar-button from vscode-elements package.
 * The react-elements currently doesn't export this component as it is relatively new.
 */

const VscodeToolbarButton = createComponent({
  tagName: "vscode-toolbar-button",
  elementClass: WC,
  react: React,
  displayName: "VscodeToolbarButton",
});

export default VscodeToolbarButton;
