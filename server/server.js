const express = require("express");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

// ------------------------------
// CORS
// ------------------------------
app.use(cors());


const sslOptions = {
  key: fs.readFileSync(
    "cert/192.168.0.112+2-key.pem"
  ),

  cert: fs.readFileSync(
    "cert/192.168.0.112+2.pem"
  ),
};

// ------------------------------
// HTTPS SERVER
// ------------------------------
const server = https.createServer(
  sslOptions,
  app
);

// ------------------------------
// SOCKET.IO
// ------------------------------
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

// ------------------------------
// SOCKET CONNECTION
// ------------------------------
io.on("connection", (socket) => {
  console.log(
    "User connected:",
    socket.id
  );

  // ----------------------------
  // JOIN ROOM
  // ----------------------------
  socket.on(
    "join-room",
    (roomId) => {
      const room =
        io.sockets.adapter.rooms.get(
          roomId
        );

      const roomSize = room
        ? room.size
        : 0;

      console.log(
        `Room ${roomId} currently has ${roomSize} user(s)`
      );

      // Maximum 2 users
      if (roomSize >= 2) {
        socket.emit(
          "room-full"
        );

        console.log(
          "Room is full:",
          roomId
        );

        return;
      }

      // Join room
      socket.join(roomId);

      console.log(
        `${socket.id} joined room: ${roomId}`
      );

      // Tell first user that second user joined
      if (roomSize === 1) {
        socket
          .to(roomId)
          .emit(
            "user-joined",
            socket.id
          );

        console.log(
          "User joined existing room"
        );
      }
    }
  );

  // ----------------------------
  // OFFER
  // ----------------------------
  socket.on(
    "offer",
    ({ roomId, offer }) => {
      console.log(
        "Offer received from:",
        socket.id
      );

      socket
        .to(roomId)
        .emit(
          "offer",
          offer
        );

      console.log(
        "Offer sent to other user"
      );
    }
  );

  // ----------------------------
  // ANSWER
  // ----------------------------
  socket.on(
    "answer",
    ({ roomId, answer }) => {
      console.log(
        "Answer received from:",
        socket.id
      );

      socket
        .to(roomId)
        .emit(
          "answer",
          answer
        );

      console.log(
        "Answer sent to other user"
      );
    }
  );

  // ----------------------------
  // ICE CANDIDATE
  // ----------------------------
  socket.on(
    "ice-candidate",
    ({ roomId, candidate }) => {
      console.log(
        "ICE candidate received from:",
        socket.id
      );

      socket
        .to(roomId)
        .emit(
          "ice-candidate",
          candidate
        );

      console.log(
        "ICE candidate sent to other user"
      );
    }
  );

  // ----------------------------
  // MICROPHONE STATE
  // ----------------------------
  socket.on(
    "microphone-state",
    ({ roomId, muted }) => {
      console.log(
        `Microphone state from ${socket.id}:`,
        muted
          ? "Muted"
          : "Unmuted"
      );

      socket
        .to(roomId)
        .emit(
          "remote-microphone-state",
          {
            muted,
          }
        );
    }
  );

  // ----------------------------
  // CAMERA STATE
  // ----------------------------
  socket.on(
    "camera-state",
    ({ roomId, cameraOff }) => {
      console.log(
        `Camera state from ${socket.id}:`,
        cameraOff
          ? "Off"
          : "On"
      );

      socket
        .to(roomId)
        .emit(
          "remote-camera-state",
          {
            cameraOff,
          }
        );
    }
  );

  // ----------------------------
  // LEAVE ROOM
  // ----------------------------
  socket.on(
    "leave-room",
    (roomId) => {
      console.log(
        `${socket.id} left room: ${roomId}`
      );

      socket
        .to(roomId)
        .emit(
          "user-left"
        );

      socket.leave(
        roomId
      );
    }
  );

  // ----------------------------
  // DISCONNECT
  // ----------------------------
  socket.on(
    "disconnect",
    () => {
      console.log(
        "User disconnected:",
        socket.id
      );
    }
  );
});

// ------------------------------
// START HTTPS SERVER
// ------------------------------
server.listen(
  5000,
  "0.0.0.0",
  () => {
    console.log(
      "================================="
    );

    console.log(
      "Secure signaling server running"
    );

    console.log(
      "https://192.168.0.112:5000"
    );

    console.log(
      "================================="
    );
  }
);