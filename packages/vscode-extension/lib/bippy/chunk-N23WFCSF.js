import { isClientEnvironment, getRDTHook } from './chunk-347RWTP3.js';

/**
 * @license bippy
 *
 * Copyright (c) Aiden Bai, Million Software, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// src/index.ts
try {
  if (isClientEnvironment()) {
    getRDTHook();
  }
} catch {
}
