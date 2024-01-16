import { ExtensionContext } from "vscode";

let _extensionContext: ExtensionContext | null = null;

export const extensionContext = new Proxy<ExtensionContext>({} as ExtensionContext, {
  get(target, prop) {
    if (!_extensionContext) {
      throw new Error("ExtensionContext has not been initialized");
    }
    return Reflect.get(_extensionContext, prop);
  },
});

export function setExtensionContext(context: ExtensionContext) {
  _extensionContext = context;
}
