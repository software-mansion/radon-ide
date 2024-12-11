export function isMoreThan24HoursAgo(lastRefresh: Date): boolean {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return lastRefresh < twentyFourHoursAgo;
}
