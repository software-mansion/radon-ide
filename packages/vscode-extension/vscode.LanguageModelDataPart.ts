/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
declare module "vscode" {
  // Types added in VSCode 1.105.0

  export enum LanguageModelPartAudience {
    Assistant = 0,
    User = 1,
    Extension = 2,
  }

  export interface LanguageModelDataPart {
    mimeType: string;
    data: Uint8Array<ArrayBufferLike>;
    audience: LanguageModelPartAudience[] | undefined;
  }
}
