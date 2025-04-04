export interface NetworkLog {
  requestId: string;
  url: string;
  status: number;
  method: string;
  type: string;
  startTimestamp: number;
  endTimestamp: number;
  duration: number;
  headers: Record<string, string>;
}
