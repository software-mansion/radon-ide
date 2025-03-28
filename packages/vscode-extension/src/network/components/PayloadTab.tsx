import { NetworkLog } from "../hooks/useNetworkTracker";

interface PayloadTabProps {
  networkLog: NetworkLog;
}

const getParams = (url: string): Record<string, string> => {
  const urlObj = new URL(url);
  const params: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
};

const PayloadTab = ({ networkLog }: PayloadTabProps) => {
  if (!networkLog.request) {
    return null;
  }

  const payloadData = JSON.stringify(
    networkLog.request.method === "GET"
      ? getParams(networkLog.request.url)
      : JSON.parse(networkLog.request.postData || "{}"),
    null,
    2
  );

  return <pre>{payloadData}</pre>;
};

export default PayloadTab;
