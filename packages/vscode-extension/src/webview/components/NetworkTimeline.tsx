import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

enum RequestType {
  XHR = "xhr",
  Image = "image",
  Script = "script",
  CSS = "css",
  Font = "font",
  Media = "media",
}

enum RequestMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  HEAD = "HEAD",
  OPTIONS = "OPTIONS",
}

type NetworkMethods = {
  RequestWillBeSent: "Network.requestWillBeSent";
  ResponseReceived: "Network.responseReceived";
  LoadingFinished: "Network.loadingFinished";
};

interface NetworkRequest {
  requestId: string;
  loaderId: string;
  timestamp: number;
  wallTime: number;
  request: {
    url: string;
    method: RequestMethod;
    headers: Record<string, string>;
  };
  type: RequestType;
  initiator: {
    type: string;
  };
}

interface NetworkResponse {
  requestId: string;
  loaderId: string;
  timestamp: number;
  type: RequestType;
  response: {
    url: string;
    status: number;
    headers: Record<string, string>;
    mimeType: string;
  };
}

interface NetworkLoadingFinished {
  requestId: string;
  timestamp: number;
  encodedDataLength: number;
}

type NetworkMessage =
  | { method: NetworkMethods["RequestWillBeSent"]; params: NetworkRequest }
  | { method: NetworkMethods["ResponseReceived"]; params: NetworkResponse }
  | { method: NetworkMethods["LoadingFinished"]; params: NetworkLoadingFinished };

const NetworkRequestsChart = () => {
  const [networkData, setNetworkData] = useState<NetworkMessage[]>([]);
  const ws = new WebSocket("ws://" + window.__websocketEndpoint);

  ws.onopen = () => {
    console.log("Connected to the server");
  };

  ws.onmessage = (message) => {
    console.log("Received message", message.data);
    const data: NetworkMessage = JSON.parse(message.data);
    setNetworkData((prev) => [...prev, data]);
  };

  useEffect(() => {
    console.log("Component mounted", window.__websocketEndpoint);
  }, []);

  return (
    <>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={networkData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="startTime"
            domain={["auto", "auto"]}
            // tickFormatter={(v) => `${v.toFixed(0)} ms`}
          />
          <YAxis name="duration" />
          <Tooltip formatter={(value) => `${value} ms`} />
          <Legend />
          <Bar dataKey="" fill="#8884d8" barSize={15} stackId="a" />
        </ComposedChart>
      </ResponsiveContainer>
    </>
  );
};

export default NetworkRequestsChart;
