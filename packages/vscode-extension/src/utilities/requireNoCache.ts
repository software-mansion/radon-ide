export function requireNoCache(...params: Parameters<typeof require.resolve>) {
  const module = require.resolve(...params);
  delete require.cache[module];
  return require(module);
}
