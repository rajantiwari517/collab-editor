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

const rooms = {}; // roomId -> { users, messages }

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.data = { roomId, username, inCall: false };
    if (!rooms[roomId]) rooms[roomId] = { users: {}, messages: [] };
    rooms[roomId].users[socket.id] = username;
    io.to(roomId).emit("users-update", Object.values(rooms[roomId].users));
    socket.emit("chat-history", rooms[roomId].messages);
  });

  socket.on("typing", ({ roomId }) => {
    socket.to(roomId).emit("user-typing", socket.data.username);
  });

  // ---------- chat ----------
  socket.on("chat-message", ({ roomId, text }) => {
  console.log("CHAT:", roomId, text);
    if (!rooms[roomId] || typeof text !== "string" || !text.trim()) return;
    const msg = {
      id: socket.id + "-" + Date.now(),
      sid: socket.id,
      user: socket.data.username,
      text: text.trim().slice(0, 500),
      time: Date.now(),
    };
    rooms[roomId].messages.push(msg);
    if (rooms[roomId].messages.length > 100) rooms[roomId].messages.shift();
    io.to(roomId).emit("chat-message", msg);
  });

  // ---------- voice / video calls ----------
  socket.on("call-join", ({ roomId }) => {
    const peers = [];
    for (const id of io.sockets.adapter.rooms.get(roomId) || []) {
      const other = io.sockets.sockets.get(id);
      if (id !== socket.id && other && other.data.inCall) peers.push(id);
    }
    socket.data.inCall = true;
    socket.emit("call-peers", peers);
  });

  socket.on("webrtc-signal", ({ to, data }) => {
    io.to(to).emit("webrtc-signal", { from: socket.id, data });
  });

  socket.on("call-leave", ({ roomId }) => {
    socket.data.inCall = false;
    socket.to(roomId).emit("call-user-left", socket.id);
  });

  socket.on("disconnect", () => {
    const { roomId } = socket.data || {};
    if (roomId && rooms[roomId]) {
      delete rooms[roomId].users[socket.id];
      io.to(roomId).emit("users-update", Object.values(rooms[roomId].users));
      io.to(roomId).emit("call-user-left", socket.id);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log("Server running on port " + PORT));