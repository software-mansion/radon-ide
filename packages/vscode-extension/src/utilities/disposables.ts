import { Disposable } from "vscode";

export function disposeAll(disposables: Disposable[]) {
  while (disposables.length) {
    const disposable = disposables.pop();
    if (disposable) {
      disposable.dispose();
    }
  }
}
