const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
  res.send("WebRTC signaling server is running");
});

let server;

// Local development
if (process.env.NODE_ENV !== "production") {
  const sslOptions = {
    key: fs.readFileSync("cert/192.168.0.112+2-key.pem"),
    cert: fs.readFileSync("cert/192.168.0.112+2.pem"),
  };

  server = https.createServer(sslOptions, app);

  console.log("Running in local HTTPS mode");
} else {
  // Production: Render handles HTTPS
  server = http.createServer(app);

  console.log("Running in production HTTP mode");
}

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    const roomSize = room ? room.size : 0;

    console.log(`Room ${roomId} currently has ${roomSize} user(s)`);

    if (roomSize >= 2) {
      socket.emit("room-full");
      console.log("Room is full:", roomId);
      return;
    }

    socket.join(roomId);

    console.log(`${socket.id} joined room: ${roomId}`);

    if (roomSize === 1) {
      socket.to(roomId).emit("user-joined", socket.id);
      console.log("User joined existing room");
    }
  });

  socket.on("offer", ({ roomId, offer }) => {
    console.log("Offer received from:", socket.id);
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    console.log("Answer received from:", socket.id);
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    console.log("ICE candidate received from:", socket.id);
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("microphone-state", ({ roomId, muted }) => {
    console.log(
      `Microphone state from ${socket.id}:`,
      muted ? "Muted" : "Unmuted"
    );

    socket.to(roomId).emit("remote-microphone-state", {
      muted,
    });
  });

  socket.on("camera-state", ({ roomId, cameraOff }) => {
    console.log(
      `Camera state from ${socket.id}:`,
      cameraOff ? "Off" : "On"
    );

    socket.to(roomId).emit("remote-camera-state", {
      cameraOff,
    });
  });

  socket.on("leave-room", (roomId) => {
    console.log(`${socket.id} left room: ${roomId}`);

    socket.to(roomId).emit("user-left");

    socket.leave(roomId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log("WebRTC signaling server running");
  console.log(`Port: ${PORT}`);
  console.log("=================================");
});