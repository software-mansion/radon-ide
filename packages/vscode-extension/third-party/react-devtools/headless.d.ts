/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Directly re-export the necessary types from the source package
export type {
  Wall,
  FrontendBridge,
  Store,
  Config,
  ElementType,
} from "react-devtools-inline/frontend";

// Import the types locally to use them in function signatures within this file
import type {
  Wall,
  FrontendBridge,
  Store,
  Config,
  ProfilingDataFrontend,
  ElementType,
} from "react-devtools-inline/frontend";

// export type {Element} from 'react-devtools-shared/src/frontend/types';
// Exporting directly from react-devtools-shared results in `Element = any` in the `dist`.
export type Element = {
  id: number;
  parentID: number;
  children: Array<number>;
  type: ElementType;
  displayName: string | null;
  key: number | string | null;
  hocDisplayNames: null | Array<string>;
  isCollapsed: boolean;
  ownerID: number;
  depth: number;
  weight: number;
  isStrictModeNonCompliant: boolean;
  compiledWithForget: boolean;
};

// import type {StateContext} from 'react-devtools-shared/src/devtools/views/Components/TreeContext';
// Exporting directly from react-devtools-shared results in `StateContext = any` in the `dist`.
export type StateContext = {
  numElements: number;
  ownerSubtreeLeafElementID: number | null;
  searchIndex: number | null;
  searchResults: Array<number>;
  searchText: string;
  ownerID: number | null;
  ownerFlatTree: Array<Element> | null;
  inspectedElementID: number | null;
  inspectedElementIndex: number | null;
};

// Define function signatures using the locally imported types
export function createBridge(wall: Wall): FrontendBridge;
export function createStore(bridge: FrontendBridge, config?: Config): Store;
export function prepareProfilingDataExport(profilingDataFrontend: ProfilingDataFrontend): any;
export function prepareProfilingDataFrontendFromExport(exportString: any): ProfilingDataFrontend;
export function printStore(
  store: Store,
  includeWeight?: boolean,
  state?: StateContext | null
): string;
