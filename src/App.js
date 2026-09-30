import {
  useEffect,
  useRef,
  useState,
} from "react";

import { io } from "socket.io-client";

import "./App.css";

function App() {
  // ==========================================
  // VIDEO REFERENCES
  // ==========================================

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // ==========================================
  // WEBRTC REFERENCES
  // ==========================================

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // ICE candidates received before
  // remote description is ready
  const pendingCandidatesRef = useRef([]);

  // ==========================================
  // ROOM REFERENCE
  // ==========================================

  const roomIdRef = useRef("");

  // ==========================================
  // STATE
  // ==========================================

  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] =
    useState(false);

  const [remoteMuted, setRemoteMuted] =
    useState(false);

  const [remoteCameraOff, setRemoteCameraOff] =
    useState(false);

  const [connected, setConnected] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  // ==========================================
  // START CAMERA + MICROPHONE
  // ==========================================

  const startLocalMedia = async () => {
    try {
      // Reuse existing stream
      if (localStreamRef.current) {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject =
            localStreamRef.current;

          try {
            await localVideoRef.current.play();
          } catch (error) {
            console.log(
              "Local video play:",
              error
            );
          }
        }

        return localStreamRef.current;
      }

      console.log(
        "Requesting camera and microphone..."
      );

      if (!navigator.mediaDevices) {
        throw new Error(
          "Camera and microphone are not available. HTTPS is required."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject =
          stream;

        try {
          await localVideoRef.current.play();
        } catch (error) {
          console.log(
            "Local video play:",
            error
          );
        }
      }

      setMuted(false);
      setCameraOff(false);

      console.log(
        "Camera and microphone connected"
      );

      return stream;
    } catch (error) {
      console.error(
        "Camera/microphone error:",
        error
      );

      if (
        error.name ===
        "NotAllowedError"
      ) {
        alert(
          "Camera/microphone permission was denied. Please allow access in the browser."
        );
      } else if (
        error.name ===
        "NotFoundError"
      ) {
        alert(
          "No camera or microphone was found."
        );
      } else if (
        error.name ===
        "NotReadableError"
      ) {
        alert(
          "The camera or microphone is already being used by another application."
        );
      } else {
        alert(
          "Unable to access camera/microphone. Make sure you are using HTTPS."
        );
      }

      return null;
    }
  };

  // ==========================================
  // CREATE PEER CONNECTION
  // ==========================================

  const createPeerConnection = () => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (error) {
        console.log(
          "Error closing old connection:",
          error
        );
      }
    }

    const peerConnection =
      new RTCPeerConnection({
        iceServers: [
          {
            urls:
              "stun:stun.l.google.com:19302",
          },
        ],
      });

    // ========================================
    // ICE CANDIDATE
    // ========================================

    peerConnection.onicecandidate = (
      event
    ) => {
      if (
        event.candidate &&
        socketRef.current &&
        socketRef.current.connected &&
        roomIdRef.current
      ) {
        socketRef.current.emit(
          "ice-candidate",
          {
            roomId:
              roomIdRef.current,
            candidate:
              event.candidate,
          }
        );

        console.log(
          "ICE candidate sent"
        );
      }
    };

    // ========================================
    // REMOTE TRACK
    // ========================================

    peerConnection.ontrack = (
      event
    ) => {
      console.log(
        "Remote track received"
      );

      if (
        remoteVideoRef.current &&
        event.streams &&
        event.streams[0]
      ) {
        remoteVideoRef.current.srcObject =
          event.streams[0];

        remoteVideoRef.current
          .play()
          .catch((error) => {
            console.log(
              "Remote video play:",
              error
            );
          });
      }

      setConnected(true);
    };

    // ========================================
    // CONNECTION STATE
    // ========================================

    peerConnection.onconnectionstatechange =
      () => {
        console.log(
          "Connection state:",
          peerConnection.connectionState
        );

        if (
          peerConnection.connectionState ===
          "connected"
        ) {
          setConnected(true);
        }

        if (
          peerConnection.connectionState ===
            "disconnected" ||
          peerConnection.connectionState ===
            "failed" ||
          peerConnection.connectionState ===
            "closed"
        ) {
          setConnected(false);
        }
      };

    // ========================================
    // ICE CONNECTION STATE
    // ========================================

    peerConnection.oniceconnectionstatechange =
      () => {
        console.log(
          "ICE connection state:",
          peerConnection.iceConnectionState
        );
      };

    return peerConnection;
  };

  // ==========================================
  // SOCKET + WEBRTC
  // ==========================================

  useEffect(() => {
    console.log(
      "Starting Socket.IO connection..."
    );

    // ========================================
    // HTTPS SOCKET.IO
    // ========================================

    socketRef.current = io(
      "https://192.168.0.112:5000",
      {
        // Polling first for HTTPS testing
        transports: ["polling"],

        reconnection: true,

        reconnectionAttempts: 5,

        timeout: 10000,
      }
    );

    // ========================================
    // SOCKET CONNECT
    // ========================================

    socketRef.current.on(
      "connect",
      () => {
        console.log(
          "================================="
        );

        console.log(
          "Connected to signaling server"
        );

        console.log(
          "Socket ID:",
          socketRef.current.id
        );

        console.log(
          "Transport:",
          socketRef.current.io.engine
            .transport.name
        );

        console.log(
          "================================="
        );
      }
    );

    // ========================================
    // SOCKET CONNECT ERROR
    // ========================================

    socketRef.current.on(
      "connect_error",
      (error) => {
        console.error(
          "Socket connection error:",
          error.message
        );

        console.error(
          "Full socket error:",
          error
        );
      }
    );

    // ========================================
    // SOCKET DISCONNECT
    // ========================================

    socketRef.current.on(
      "disconnect",
      (reason) => {
        console.log(
          "Socket disconnected:",
          reason
        );
      }
    );

    // ========================================
    // USER JOINED
    // ========================================

    socketRef.current.on(
      "user-joined",
      async (userId) => {
        console.log(
          "Another user joined:",
          userId
        );

        try {
          const stream =
            await startLocalMedia();

          if (!stream) {
            return;
          }

          peerConnectionRef.current =
            createPeerConnection();

          console.log(
            "Peer connection created"
          );

          // Add local tracks
          stream
            .getTracks()
            .forEach((track) => {
              peerConnectionRef.current.addTrack(
                track,
                stream
              );
            });

          console.log(
            "Local tracks added"
          );

          // Create offer
          const offer =
            await peerConnectionRef.current.createOffer();

          // Set local description
          await peerConnectionRef.current.setLocalDescription(
            offer
          );

          console.log(
            "Offer created and local description set"
          );

          // Send offer
          socketRef.current.emit(
            "offer",
            {
              roomId:
                roomIdRef.current,
              offer,
            }
          );

          console.log(
            "Offer sent"
          );
        } catch (error) {
          console.error(
            "Error creating offer:",
            error
          );
        }
      }
    );

    // ========================================
    // RECEIVE OFFER
    // ========================================

    socketRef.current.on(
      "offer",
      async (offer) => {
        console.log(
          "Offer received"
        );

        try {
          const stream =
            await startLocalMedia();

          if (!stream) {
            return;
          }

          peerConnectionRef.current =
            createPeerConnection();

          console.log(
            "Peer connection created for answer"
          );

          // Add local tracks
          stream
            .getTracks()
            .forEach((track) => {
              peerConnectionRef.current.addTrack(
                track,
                stream
              );
            });

          // Set remote description
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(
              offer
            )
          );

          console.log(
            "Remote description set"
          );

          // Add pending ICE candidates
          if (
            pendingCandidatesRef.current
              .length > 0
          ) {
            for (const candidate of
              pendingCandidatesRef.current) {
              try {
                await peerConnectionRef.current.addIceCandidate(
                  new RTCIceCandidate(
                    candidate
                  )
                );
              } catch (error) {
                console.error(
                  "Pending ICE error:",
                  error
                );
              }
            }

            pendingCandidatesRef.current =
              [];
          }

          // Create answer
          const answer =
            await peerConnectionRef.current.createAnswer();

          // Set local description
          await peerConnectionRef.current.setLocalDescription(
            answer
          );

          // Send answer
          socketRef.current.emit(
            "answer",
            {
              roomId:
                roomIdRef.current,
              answer,
            }
          );

          console.log(
            "Answer sent"
          );
        } catch (error) {
          console.error(
            "Error handling offer:",
            error
          );
        }
      }
    );

    // ========================================
    // RECEIVE ANSWER
    // ========================================

    socketRef.current.on(
      "answer",
      async (answer) => {
        console.log(
          "Answer received"
        );

        if (
          !peerConnectionRef.current
        ) {
          return;
        }

        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(
              answer
            )
          );

          console.log(
            "Remote answer description set"
          );

          // Add pending ICE candidates
          if (
            pendingCandidatesRef.current
              .length > 0
          ) {
            for (const candidate of
              pendingCandidatesRef.current) {
              try {
                await peerConnectionRef.current.addIceCandidate(
                  new RTCIceCandidate(
                    candidate
                  )
                );
              } catch (error) {
                console.error(
                  "Pending ICE error:",
                  error
                );
              }
            }

            pendingCandidatesRef.current =
              [];
          }
        } catch (error) {
          console.error(
            "Error setting answer:",
            error
          );
        }
      }
    );

    // ========================================
    // RECEIVE ICE CANDIDATE
    // ========================================

    socketRef.current.on(
      "ice-candidate",
      async (candidate) => {
        console.log(
          "ICE candidate received"
        );

        // Peer does not exist yet
        if (
          !peerConnectionRef.current
        ) {
          pendingCandidatesRef.current.push(
            candidate
          );

          return;
        }

        // Remote description not ready
        if (
          !peerConnectionRef.current
            .remoteDescription
        ) {
          pendingCandidatesRef.current.push(
            candidate
          );

          console.log(
            "ICE candidate stored"
          );

          return;
        }

        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );

          console.log(
            "ICE candidate added"
          );
        } catch (error) {
          console.error(
            "Error adding ICE candidate:",
            error
          );
        }
      }
    );

    // ========================================
    // ROOM FULL
    // ========================================

    socketRef.current.on(
      "room-full",
      () => {
        alert(
          "This room is already full. Only 2 users are allowed."
        );

        setJoined(false);
        setConnected(false);

        roomIdRef.current = "";
      }
    );

    // ========================================
    // REMOTE MICROPHONE
    // ========================================

    socketRef.current.on(
      "remote-microphone-state",
      ({ muted }) => {
        console.log(
          "Remote microphone:",
          muted
            ? "Muted"
            : "Unmuted"
        );

        setRemoteMuted(muted);
      }
    );

    // ========================================
    // REMOTE CAMERA
    // ========================================

    socketRef.current.on(
      "remote-camera-state",
      ({ cameraOff }) => {
        console.log(
          "Remote camera:",
          cameraOff
            ? "Off"
            : "On"
        );

        setRemoteCameraOff(
          cameraOff
        );
      }
    );

    // ========================================
    // USER LEFT
    // ========================================

    socketRef.current.on(
      "user-left",
      () => {
        console.log(
          "Other user left the call"
        );

        setConnected(false);

        setRemoteMuted(false);
        setRemoteCameraOff(false);

        pendingCandidatesRef.current =
          [];

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject =
            null;
        }

        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();

          peerConnectionRef.current =
            null;
        }
      }
    );

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      console.log(
        "Cleaning up application..."
      );

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => {
            track.stop();
          });
      }
    };
  }, []);

  // ==========================================
  // JOIN ROOM
  // ==========================================

  const joinRoom = async () => {
    const trimmedRoomId =
      roomId.trim();

    if (!trimmedRoomId) {
      alert(
        "Please enter a Room ID"
      );

      return;
    }

    if (!socketRef.current) {
      alert(
        "Socket connection is not ready."
      );

      return;
    }

    if (
      !socketRef.current.connected
    ) {
      alert(
        "Not connected to the server. Please wait and try again."
      );

      return;
    }

    // Start camera and microphone
    const stream =
      await startLocalMedia();

    if (!stream) {
      return;
    }

    roomIdRef.current =
      trimmedRoomId;

    // Clear old peer
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();

      peerConnectionRef.current =
        null;
    }

    pendingCandidatesRef.current =
      [];

    // Join room
    socketRef.current.emit(
      "join-room",
      trimmedRoomId
    );

    setRoomId(trimmedRoomId);
    setJoined(true);

    console.log(
      "Joined room:",
      trimmedRoomId
    );
  };

  // ==========================================
  // MUTE
  // ==========================================

  const toggleMute = () => {
    if (!localStreamRef.current) {
      return;
    }

    const audioTrack =
      localStreamRef.current.getAudioTracks()[0];

    if (!audioTrack) {
      return;
    }

    audioTrack.enabled =
      !audioTrack.enabled;

    const newMuted =
      !audioTrack.enabled;

    setMuted(newMuted);

    if (
      socketRef.current &&
      socketRef.current.connected &&
      roomIdRef.current
    ) {
      socketRef.current.emit(
        "microphone-state",
        {
          roomId:
            roomIdRef.current,
          muted:
            newMuted,
        }
      );
    }

    console.log(
      newMuted
        ? "Microphone muted"
        : "Microphone unmuted"
    );
  };

  // ==========================================
  // CAMERA ON / OFF
  // ==========================================

  const toggleCamera = async () => {
    if (!localStreamRef.current) {
      return;
    }

    const videoTrack =
      localStreamRef.current.getVideoTracks()[0];

    if (!videoTrack) {
      return;
    }

    // Enable / disable video track
    videoTrack.enabled =
      !videoTrack.enabled;

    const newCameraOff =
      !videoTrack.enabled;

    setCameraOff(
      newCameraOff
    );

    // IMPORTANT:
    // Keep video element mounted
    if (
      localVideoRef.current
    ) {
      localVideoRef.current.srcObject =
        localStreamRef.current;

      if (!newCameraOff) {
        try {
          await localVideoRef.current.play();
        } catch (error) {
          console.log(
            "Camera play error:",
            error
          );
        }
      }
    }

    // Tell remote user
    if (
      socketRef.current &&
      socketRef.current.connected &&
      roomIdRef.current
    ) {
      socketRef.current.emit(
        "camera-state",
        {
          roomId:
            roomIdRef.current,

          cameraOff:
            newCameraOff,
        }
      );
    }

    console.log(
      newCameraOff
        ? "Camera turned off"
        : "Camera turned on"
    );
  };

  // ==========================================
  // END CALL
  // ==========================================

  const endCall = () => {
    console.log(
      "Ending call..."
    );

    if (
      socketRef.current &&
      socketRef.current.connected &&
      roomIdRef.current
    ) {
      socketRef.current.emit(
        "leave-room",
        roomIdRef.current
      );
    }

    // Close peer
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();

      peerConnectionRef.current =
        null;
    }

    // Stop camera + microphone
    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      localStreamRef.current =
        null;
    }

    // Clear local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        null;
    }

    // Clear remote video
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        null;
    }

    pendingCandidatesRef.current =
      [];

    roomIdRef.current = "";

    setJoined(false);
    setConnected(false);

    setMuted(false);
    setCameraOff(false);

    setRemoteMuted(false);
    setRemoteCameraOff(false);

    console.log(
      "Call ended"
    );
  };

  // ==========================================
  // COPY ROOM ID
  // ==========================================

  const copyRoomId = async () => {
    if (!roomId.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        roomId.trim()
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);

      console.log(
        "Room ID copied"
      );
    } catch (error) {
      console.error(
        "Unable to copy Room ID:",
        error
      );
    }
  };

  // ==========================================
  // COPY INVITE LINK
  // ==========================================

  const copyInviteLink = async () => {
    if (!roomId.trim()) {
      alert(
        "Please enter a Room ID first."
      );

      return;
    }

    const inviteLink =
      `${window.location.origin}/?room=${encodeURIComponent(
        roomId.trim()
      )}`;

    try {
      await navigator.clipboard.writeText(
        inviteLink
      );

      alert(
        "Invite link copied!"
      );

      console.log(
        "Invite link:",
        inviteLink
      );
    } catch (error) {
      console.error(
        "Unable to copy invite link:",
        error
      );
    }
  };

  // ==========================================
  // GET ROOM FROM URL
  // ==========================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const roomFromUrl =
      params.get("room");

    if (roomFromUrl) {
      setRoomId(roomFromUrl);
    }
  }, []);

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="app">

      {/* =====================================
          HEADER
      ====================================== */}

      <header className="header">

        <h1>
          WebRTC Video Call
        </h1>

        {joined && (
          <div className="room-info">

            <span>
              Room:{" "}
              <strong>
                {roomId}
              </strong>
            </span>

            <button
              className="copy-button"
              onClick={copyRoomId}
            >
              {copied
                ? "Copied ✓"
                : "Copy Room ID"}
            </button>

            <button
              className="copy-button"
              onClick={copyInviteLink}
            >
              Copy Invite Link
            </button>

          </div>
        )}

      </header>

      {/* =====================================
          JOIN SCREEN
      ====================================== */}

      {!joined && (
        <div className="join-container">

          <div className="join-card">

            <h2>
              Join a Video Call
            </h2>

            <p>
              Enter a Room ID to start
              or join a video call.
            </p>

            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(event) =>
                setRoomId(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  joinRoom();
                }
              }}
            />

            <button
              className="join-button"
              onClick={joinRoom}
            >
              Join Room
            </button>

          </div>

        </div>
      )}

      {/* =====================================
          VIDEO CALL
      ====================================== */}

      {joined && (
        <div className="call-container">

          {/* STATUS */}

          <div className="status">

            {!connected && (
              <p>
                👤 Waiting for another
                user...
              </p>
            )}

            {connected && (
              <p className="connected">
                🟢 Connected
              </p>
            )}

          </div>

          {/* =================================
              VIDEO GRID
          ================================== */}

          <div className="video-grid">

            {/* ===============================
                LOCAL VIDEO
            ================================ */}

            <div className="video-card">

              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
              />

              {cameraOff && (
                <div className="waiting">

                  <div className="waiting-icon">
                    📵
                  </div>

                  <p>
                    Your camera is off
                  </p>

                </div>
              )}

              <div className="video-label">

                You

                {muted && (
                  <span>
                    {" "}🔇
                  </span>
                )}

                {cameraOff && (
                  <span>
                    {" "}📵
                  </span>
                )}

              </div>

            </div>

            {/* ===============================
                REMOTE VIDEO
            ================================ */}

            <div className="video-card">

              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
              />

              {(!connected ||
                remoteCameraOff) && (
                <div className="waiting">

                  <div className="waiting-icon">
                    👤
                  </div>

                  <p>
                    {remoteCameraOff
                      ? "Camera is off"
                      : "Waiting for another user..."}
                  </p>

                </div>
              )}

              <div className="video-label">

                Other User

                {remoteMuted && (
                  <span>
                    {" "}🔇
                  </span>
                )}

                {remoteCameraOff && (
                  <span>
                    {" "}📵
                  </span>
                )}

              </div>

            </div>

          </div>

          {/* =================================
              CONTROLS
          ================================== */}

          <div className="controls">

            <button
              className={
                muted
                  ? "control-button active"
                  : "control-button"
              }
              onClick={toggleMute}
            >
              {muted
                ? "🔇 Unmute"
                : "🎤 Mute"}
            </button>

            <button
              className={
                cameraOff
                  ? "control-button active"
                  : "control-button"
              }
              onClick={toggleCamera}
            >
              {cameraOff
                ? "📹 Camera On"
                : "📹 Camera Off"}
            </button>

            <button
              className="end-call-button"
              onClick={endCall}
            >
              📞 End Call
            </button>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;