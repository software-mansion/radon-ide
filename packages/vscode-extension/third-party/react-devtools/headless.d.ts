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
} from 'react-devtools-inline/frontend';

// Import the types locally to use them in function signatures within this file
import type {
  Wall,
  FrontendBridge,
  Store,
  Config,
  ProfilingDataFrontend,
} from 'react-devtools-inline/frontend';

// Define function signatures using the locally imported types
export function createBridge(wall: Wall): FrontendBridge;
export function createStore(bridge: FrontendBridge, config?: Config): Store;
export function prepareProfilingDataExport(
  profilingDataFrontend: ProfilingDataFrontend,
): any;
export function prepareProfilingDataFrontendFromExport(
  exportString: any,
): ProfilingDataFrontend;
