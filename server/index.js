const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const WebSocket = require("ws");
const { setupWSConnection } = require("y-websocket/bin/utils");

const app = express();
app.use(cors());
app.get("/", (req, res) => res.send("Collab editor server running"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Yjs text syncing, served on the same port under /yjs
const wss = new WebSocket.Server({ noServer: true });
wss.on("connection", (conn, req) => setupWSConnection(conn, req));
server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith("/yjs")) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  }
});

const rooms = {}; // roomId -> { users }

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.data = { roomId, username };
    if (!rooms[roomId]) rooms[roomId] = { users: {} };
    rooms[roomId].users[socket.id] = username;
    io.to(roomId).emit("users-update", Object.values(rooms[roomId].users));
  });

  socket.on("typing", ({ roomId }) => {
    socket.to(roomId).emit("user-typing", socket.data.username);
  });

  socket.on("disconnect", () => {
    const { roomId } = socket.data || {};
    if (roomId && rooms[roomId]) {
      delete rooms[roomId].users[socket.id];
      io.to(roomId).emit("users-update", Object.values(rooms[roomId].users));
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log("Server running on port " + PORT));