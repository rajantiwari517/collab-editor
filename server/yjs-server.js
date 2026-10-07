const http = require("http");
const WebSocket = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

const server = http.createServer((req, res) => res.end("Yjs server running"));
const wss = new WebSocket.Server({ server });

wss.on("connection", (conn, req) => setupWSConnection(conn, req));

server.listen(1234, () => console.log("Yjs server running on port 1234"));