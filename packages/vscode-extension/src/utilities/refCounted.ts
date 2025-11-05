import { Disposable } from "vscode";

export type RefCounted<T> = T & { retain(): void; disposeInner(): void; refCount: number };

/**
 * Wraps a Disposable object with reference counting capabilities.
 *
 * The returned proxy object exposes the following additional properties and methods:
 * - `retain()`: Increments the reference count.
 * - `dispose()`: Decrements the reference count and disposes the underlying object when the count reaches zero.
 * - `disposeInner()`: Immediately disposes the underlying object, regardless of the reference count.
 * - `refCount`: Returns the current reference count.
 *
 * Accessing any property of the wrapped object after disposal will throw an error.
 *
 * @typeParam T - The type of the Disposable object to be wrapped.
 * @param inner - The Disposable object to be reference counted.
 * @returns A proxy object that implements reference counting for the given Disposable.
 */
export function createRefCounted<T extends Disposable>(inner: T): RefCounted<T> {
  let counter = 1;
  let disposed = false;
  function retain() {
    counter += 1;
  }
  function dispose() {
    counter -= 1;
    if (counter <= 0 && !disposed) {
      disposed = true;
      inner.dispose();
    }
  }
  function disposeInner() {
    counter = 0;
    disposed = true;
    inner.dispose();
  }
  const proxied = new Proxy<T>(inner, {
    get(target, prop, receiver) {
      if (prop === "retain") {
        return retain;
      }
      if (prop === "dispose") {
        return dispose;
      }
      if (prop === "disposeInner") {
        return disposeInner;
      }
      if (prop === "refCount") {
        return counter;
      }
      if (disposed) {
        throw new Error(`Trying to access property "${prop.toString()}" of a disposed object`);
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  return proxied as RefCounted<T>;
}
