import { IDEDomainCall, WebviewMessage } from "../types/panelMessageProtocol";

let nextId = 0;

export function generateId(): string {
  return `${nextId++}`;
}

/**
 * Creates a promise that resolves when a matching IDE response message is received.
 * Sets up a window message listener that waits for a message with the specified
 * messageId and method, then resolves with the result.
 *
 * @param messageId - Message identifier to match in the response
 * @param messageExpectedMethod - The IDE method to match in the response
 * @param resultTransformer - Optional callback to perform operations on result before resolving
 * @returns Promise that resolves with the transformed result
 */
export function createIDEResponsePromise<T>(
  messageId: string,
  messageExpectedMethod: IDEDomainCall,
  resultTransformer?: (result: unknown) => T
): Promise<T> {
  const { promise, resolve } = Promise.withResolvers<T>();

  const listener = (message: MessageEvent) => {
    try {
      const { payload }: WebviewMessage = message.data;
      if (payload.method !== messageExpectedMethod || payload.messageId !== messageId) {
        return;
      }

      const result = resultTransformer ? resultTransformer(payload.result) : (payload.result as T);

      resolve(result);
      window.removeEventListener("message", listener);
    } catch (error) {
      console.error("Error parsing Window message:", error);
    }
  };

  // Setup listener to capture the response
  window.addEventListener("message", listener);

  return promise;
}
