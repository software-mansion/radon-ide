import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);

  const ws = new WebSocket("ws://" + window.__websocketEndpoint);

  ws.onopen = () => {
    console.log("Connected to the server");
  };

  ws.onmessage = (message) => {
    setMessages([...messages, message.data]);
    console.log("Received message", message.data);
  };

  useEffect(() => {
    console.log("Component mounted", window.__websocketEndpoint);
  }, []);

  return (
    <>
      {messages.map((message, index) => {
        return <div key={index}>{message}</div>;
      })}
    </>
  );
}

export default App;
