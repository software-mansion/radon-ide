export function generateId(): string {
  return Math.random().toString(36).substring(7);
}
