import { fileURLToPath } from "url";
import http from "http";
import path from "path";
import express from "express";
import multer from "multer";
import compression from "compression";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
let server = null;
let wss = null;
let appWebsocket = null;

let users = [
  { id: 1, name: "John Doe", email: "john@example.com" },
  { id: 2, name: "Jane Doe", email: "jane@example.com" },
];

app.use(express.static("."));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

app.get("/api/get", (req, res) => {
  const { page, sort } = req.query;
  res.setHeader("Content-Type", "application/json");
  res.json({
    meta: {
      page: page || 1,
      sort: sort || "asc",
      total: users.length,
    },
    data: users,
  });
});

app.post("/api/post", (req, res) => {
  const newUser = { id: users.length + 1, ...req.body };
  users.push(newUser);

  res.status(201).json({
    message: "Post request successful",
    userId: newUser.id,
    captured_data: req.body,
  });
});

app.patch("/api/patch/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const user = users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  Object.assign(user, req.body);
  console.log(`Updating profile for ID: ${req.params.id}`);
  res.status(204).send();
});

app.put("/api/put/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  users[index] = { id, ...req.body };
  res.status(200).json({
    message: "Put request successful",
    user: users[index],
  });
});

app.delete("/api/delete/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  users.splice(index, 1);
  res.json({ message: "Delete request successful", deletedId: id });
});

app.post("/api/multipart", upload.single("multipart_data"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }
  const description = req.body.description;
  console.log("MULTIPART RECEIVED");

  res.json({
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    metadata_received: description,
  });
});

app.post("/api/form", (req, res) => {
  const { username } = req.body;
  res.json({
    type: "Legacy Form",
    received_user: username,
    login_status: "active",
  });
});

app.get("/api/binary", (req, res) => {
  const buffer = Buffer.alloc(128);
  for (let i = 0; i < 128; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(buffer);
});

app.get("/api/compress", compression(), (req, res) => {
  const largeDataSet = [];
  for (let i = 0; i < 1000; i++) {
    largeDataSet.push({ id: i, text: "Repeating string to compress " + i });
  }
  res.json(largeDataSet);
});

app.get("/api/redirect", (req, res) => {
  res.redirect(301, "/api/get?redirected=true");
});

app.get("/api/error/client-error", (req, res) => {
  res.status(403).json({
    error: "Forbidden",
    message: "Invalid Token provided",
    code: 4003,
  });
});

app.get("/api/error/server-error", (req, res) => {
  res.status(503).send(`
        <html>
            <body>
                <h1>503 Service Unavailable</h1>
                <p>The upstream server is currently unavailable.</p>
                <hr>
                <address>Nginx/1.18.0</address>
            </body>
        </html>
    `);
});

app.post("/api/graphql", (req, res) => {
  const { operationName, variables } = req.body;

  let data = {};
  if (operationName === "GetUserProfile") {
    data = {
      user: {
        id: variables?.id || "1",
        name: "GraphQL User",
      },
    };
  } else {
    data = { message: "Unknown operation" };
  }

  res.json({ data: data });
});

app.get("/api/stream-xhr", (req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");

  res.write("--- Stream Started ---\n");

  let chunkCount = 0;
  const maxChunks = 5;

  const interval = setInterval(() => {
    chunkCount++;
    const timestamp = new Date().toLocaleTimeString();
    res.write(`[Chunk ${chunkCount}] Data received at ${timestamp}\n`);

    if (chunkCount >= maxChunks) {
      clearInterval(interval);
      res.write("--- Stream Finished ---");
      res.end();
    }
  }, 1000);
});

app.get("/api/error/truncated", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": "1024",
  });
  res.write(
    '{ "message": "This is the start of a valid JSON object, but it will die soon..."'
  );
  setTimeout(() => {
    console.log("error: Destroying socket for /truncated");
    req.socket.destroy();
  }, 100);
});

app.get("/api/error/json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send('{ "status": "ok", "data": [1, 2, 3, "oops...');
});

app.get("/api/error/protocol", (req, res) => {
  const socket = req.socket;
  console.log("error: Sending garbage protocol data");
  socket.write("BAD_PROTOCOL 999 WHAT?\r\n");
  socket.write("Content-Type: ?????\r\n");
  socket.write("\r\n");
  socket.write("Some raw data");
  socket.end();
});

app.get("/api/error/hang", (req, res) => {
  console.log("error: Hanging connection intentionally (Zombie Request)...");
});

app.get("/api/large-body", (req, res) => {
  console.log("START");
  const targetSizeMB = 5;
  const dummyString = "X ".repeat(1024);
  const iterations = targetSizeMB * 512;

  const largeData = [];
  for (let i = 0; i < iterations; i++) {
    largeData.push(dummyString);
  }
  res.send(largeData.join(""));
  console.log("END");
});

app.get("/api/delay", (req, res) => {
  const delay = 3000;
  console.log(`Delay: Holding request for ${delay}ms...`);

  setTimeout(() => {
    res.json({
      message: "Response received after delay",
      delay_ms: delay,
    });
  }, delay);
});

app.get("/api/image", (req, res) => {
  res.sendFile(path.join(__dirname, "img.png"));
});

app.use((req, res) => {
  res.status(404).json({ error: "Not Found", endpoint: req.originalUrl });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// -- WebSocket Helpers --

export function getAppWebsocket() {
  return appWebsocket;
}

export function waitForMessage(id, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const currentWs = getAppWebsocket();
    if (!currentWs) {
      reject(new Error("No websocket connection"));
      return;
    }

    const timer = setTimeout(() => {
      currentWs.off("message", handler);
      reject(new Error("Timeout waiting for message"));
    }, timeoutMs);

    const handler = (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.id === id) {
          clearTimeout(timer);
          currentWs.off("message", handler);
          resolve(msg);
        }
      } catch (e) {
        // Ignore parse errors for specific message wait
      }
    };

    currentWs.on("message", handler);
  });
}

export function closeServer() {
  if (wss) {
    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {}
    });

    wss.close(() => {
      console.log("WebSocket server closed");
    });
    wss = null;
    appWebsocket = null;
  }

  if (server) {
    server.close(() => {
      console.log("HTTP server closed");
    });
    server = null;
  }
}

export function initServer(port = 8080) {
  if (wss) {
    console.warn("WebSocket server already initialized");
    return;
  }

  server = http.createServer(app);
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    appWebsocket = ws;
    console.log("WS: Client connected");

    ws.send(
      JSON.stringify({ type: "WELCOME", message: "Connected to Live Ticker" })
    );

    ws.on("message", (message) => {
      const msgStr = message.toString();
      try {
        const msg = JSON.parse(msgStr);
        console.log("Received message:", msg);
      } catch (e) {
        console.log("Received raw message:", msgStr);
      }

      // Echo functionality merged from express server
      ws.send(JSON.stringify({ type: "ECHO", content: msgStr }));
    });

    ws.on("close", () => {
      if (appWebsocket === ws) appWebsocket = null;
      console.log("Client disconnected");
    });
  });

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server listening on ws://localhost:${port}`);
  });

  return wss;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initServer(8080);
}
