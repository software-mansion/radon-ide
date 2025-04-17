/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type MessagePayload =
  | null
  | string
  | number
  | boolean
  | {[key: string]: MessagePayload}
  | MessagePayload[];
export type Message = {event: string; payload?: MessagePayload};

export type WallListener = (message: Message) => void;
export type Wall = {
  listen: (fn: WallListener) => Function;
  send: (event: string, payload?: MessagePayload) => void;
};

export type FrontendBridge = {
  addListener(event: string, listener: (params: unknown) => any): void;
  removeListener(event: string, listener: Function): void;
  shutdown: () => void;
};
export type Store = Object;

export function createBridge(wall: Wall): FrontendBridge;
export function createStore(bridge: Bridge, config?: Config): Store;
