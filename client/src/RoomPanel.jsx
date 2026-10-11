import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

function RemoteVideo({ stream, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <div className="tile">
      <video ref={ref} autoPlay playsInline />
      <span className="tile-label">{label}</span>
    </div>
  );
}

export default function RoomPanel({ roomId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(socket.connected);

  const [inCall, setInCall] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [muted, setMuted] = useState(false);
  const [remotes, setRemotes] = useState({});
  const [incoming, setIncoming] = useState(null);
  const [notice, setNotice] = useState("");

  const peers = useRef({});
  const localStream = useRef(null);
  const localVideo = useRef(null);
  const bottomRef = useRef(null);
  const openRef = useRef(false);
  const endCallRef = useRef(null);
  const inCallRef = useRef(false);
  const wantVideo = useRef(false);
  const roomRef = useRef(roomId);
  roomRef.current = roomId;

  useEffect(() => {
    openRef.current = open;
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (inCall && localVideo.current) {
      localVideo.current.srcObject = localStream.current;
    }
  }, [inCall]);

  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
    };
  }, []);

  // ringing sound while a call is incoming, and give up after 30 seconds
  useEffect(() => {
    if (!incoming) return;
    let ctx;
    const beep = () => {
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 700;
        g.gain.value = 0.08;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.4);
      } catch (err) {
        // sound is blocked, the banner still shows
      }
    };
    beep();
    const timer = setInterval(beep, 1500);
    const giveUp = setTimeout(() => setIncoming(null), 30000);
    return () => {
      clearInterval(timer);
      clearTimeout(giveUp);
      if (ctx) ctx.close().catch(() => {});
    };
  }, [incoming]);

  const createPeer = (id, initiator) => {
    const pc = new RTCPeerConnection(ICE);
    peers.current[id] = pc;
    pc.pending = [];
    pc.oniceconnectionstatechange = () =>
      console.log("Call connection with", id, ":", pc.iceConnectionState);

    localStream.current
      .getTracks()
      .forEach((t) => pc.addTrack(t, localStream.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("webrtc-signal", { to: id, data: { candidate: e.candidate } });
      }
    };
    pc.ontrack = (e) => {
      setRemotes((r) => ({ ...r, [id]: e.streams[0] }));
    };

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() =>
          socket.emit("webrtc-signal", { to: id, data: { sdp: pc.localDescription } })
        );
    }
    return pc;
  };

  useEffect(() => {
    const onHistory = (history) => setMessages(history);

    const onMessage = (msg) => {
      setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
      if (!openRef.current && msg.sid !== socket.id) setUnread((u) => u + 1);
    };

        const onPeers = (ids) => {
      ids.forEach((id) => createPeer(id, true));
    };

    const onIncoming = (info) => {
      if (inCallRef.current) return;
      setIncoming(info);
      setOpen(true);
    };

    const onDeclined = (name) => {
      setNotice(`${name} declined the call`);
      setTimeout(() => setNotice(""), 5000);
    };

    const onSignal = async ({ from, data }) => {
      if (!localStream.current) return;
      try {
        let pc = peers.current[from];
        if (!pc) pc = createPeer(from, false);
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          for (const c of pc.pending) await pc.addIceCandidate(c);
          pc.pending = [];
          if (data.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("webrtc-signal", {
              to: from,
              data: { sdp: pc.localDescription },
            });
          }
        } else if (data.candidate) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
          else pc.pending.push(data.candidate);
        }
      } catch (err) {
        console.error("Call signal error:", err);
      }
    };

    const onLeft = (id) => {
      // the caller hung up before we answered
      setIncoming((cur) => (cur && cur.from === id ? null : cur));
      if (peers.current[id]) {
        peers.current[id].close();
        delete peers.current[id];
      }
      setRemotes((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
    };

    socket.on("chat-history", onHistory);
    socket.on("chat-message", onMessage);
    socket.on("call-peers", onPeers);
    socket.on("incoming-call", onIncoming);
    socket.on("call-declined", onDeclined);
    socket.on("webrtc-signal", onSignal);
    socket.on("call-user-left", onLeft);

    return () => {
      socket.off("chat-history", onHistory);
      socket.off("chat-message", onMessage);
      socket.off("call-peers", onPeers);
      socket.off("incoming-call", onIncoming);
      socket.off("call-declined", onDeclined);
      socket.off("webrtc-signal", onSignal);
      socket.off("call-user-left", onLeft);
    };
  }, []);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    const id = socket.id + "-" + Date.now();
    const msg = { id, sid: socket.id, user: "You", text: t, time: Date.now() };
    setMessages((m) => [...m, msg]);
    socket.emit("chat-message", { roomId, text: t, id });
    setText("");
  };

   const startCall = async (withVideo, ring = true) => {
    console.log("startCall clicked", { withVideo, ring });
    if (ring) socket.emit("call-ring", { roomId, video: withVideo });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo,
      });
      localStream.current = stream;
      wantVideo.current = withVideo;
      inCallRef.current = true;
      setHasVideo(withVideo);
      setCameraOn(withVideo);
      setMuted(false);
      setInCall(true);
      socket.emit("call-join", { roomId });
    } catch (err) {
      console.error("Microphone/camera error:", err);
      alert("Call error: " + err.name + " - " + err.message);
    }
  };

  const endCall = () => {
    Object.values(peers.current).forEach((pc) => pc.close());
    peers.current = {};
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }
    inCallRef.current = false;
    setRemotes({});
    setInCall(false);
    socket.emit("call-leave", { roomId });
  };
  endCallRef.current = endCall;

  useEffect(() => {
    return () => endCallRef.current && endCallRef.current();
  }, []);

   const acceptCall = () => {
    const info = incoming;
    setIncoming(null);
    if (info) startCall(info.video, false);
  };

  const declineCall = () => {
    if (incoming) socket.emit("call-decline", { to: incoming.from });
    setIncoming(null);
  };

  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  const toggleCamera = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCameraOn(track.enabled);
    }
  };

  const remoteIds = Object.keys(remotes);

  return (
    <>
      {incoming && (
        <div className="incoming">
          <div className="incoming-title">
            {incoming.user} is {incoming.video ? "video" : "voice"} calling...
          </div>
          <div className="incoming-actions">
            <button className="panel-btn accept" onClick={acceptCall}>
              Accept
            </button>
            <button className="panel-btn danger" onClick={declineCall}>
              Decline
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)}>
          Chat &amp; Call
          {inCall && <span className="live-dot" />}
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
      )}

      <div className={`room-panel ${open ? "" : "hidden"}`}>
        <div className="panel-head">
          <b>Room chat {connected ? "(connected)" : "(not connected)"}</b>
          <button className="panel-btn ghost" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>

        <div className="call-bar">
          {!inCall ? (
            <>
              <button className="panel-btn" onClick={() => startCall(false)}>
                Voice call
              </button>
              <button className="panel-btn" onClick={() => startCall(true)}>
                Video call
              </button>
            </>
          ) : (
            <>
              <button className="panel-btn" onClick={toggleMute}>
                {muted ? "Unmute" : "Mute"}
              </button>
              {hasVideo && (
                <button className="panel-btn" onClick={toggleCamera}>
                  {cameraOn ? "Camera off" : "Camera on"}
                </button>
              )}
              <button className="panel-btn danger" onClick={endCall}>
                End call
              </button>
            </>
          )}
        </div>

        {inCall && (
          <div className="videos">
            <div className="tile">
              <video ref={localVideo} autoPlay playsInline muted />
              <span className="tile-label">You</span>
            </div>
            {remoteIds.map((id, i) => (
              <RemoteVideo key={id} stream={remotes[id]} label={`Friend ${i + 1}`} />
            ))}
            {remoteIds.length === 0 && (
              <div className="waiting">
                {notice || "Calling... waiting for someone to pick up"}
              </div>
            )}
          </div>
        )}

        <div className="msgs">
          {messages.length === 0 && (
            <div className="empty">No messages yet. Say hi!</div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.sid === socket.id ? "mine" : ""}`}>
              <div className="msg-meta">
                {m.sid === socket.id ? "You" : m.user} ·{" "}
                {new Date(m.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {m.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message..."
          />
          <button className="panel-btn solid" onClick={send}>
            Send
          </button>
        </div>
      </div>
    </>
  );
}