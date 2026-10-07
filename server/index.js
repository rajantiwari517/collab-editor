const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = {}; // roomId -> { code, users }

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);
    socket.data = { roomId, username };
    if (!rooms[roomId]) rooms[roomId] = { code: "// Start coding...", users: {} };
    rooms[roomId].users[socket.id] = username;

    socket.emit("init-code", rooms[roomId].code);
    io.to(roomId).emit("users-update", Object.values(rooms[roomId].users));
  });

 socket.on("code-change", ({ roomId, code }) => {
  if (!rooms[roomId]) return;
  rooms[roomId].code = code;
  socket.to(roomId).emit("code-update", code);
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

server.listen(5000, () => console.log("Server running on port 5000"));