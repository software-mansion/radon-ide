// Based on https://github.com/microsoft/vscode-js-debug/blob/3be255753c458f231e32c9ef5c60090236780060/src/adapter/templates/getArraySlots.ts#L11
function getArraySlots(this: unknown[], start: number, count: number) {
  const result = {};
  const from = start === -1 ? 0 : start;
  const to = count === -1 ? this.length : start + count;
  for (let i = from; i < to && i < this.length; ++i) {
    const descriptor = Object.getOwnPropertyDescriptor(this, i);
    if (descriptor) {
      Object.defineProperty(result, i, descriptor);
    }
  }

  return result;
}

export default getArraySlots;
