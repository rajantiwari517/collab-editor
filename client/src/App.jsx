import { useState } from "react";
import CodeRoom from "./CodeRoom";

export default function App() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  const createRoom = () => setRoomId(Math.random().toString(36).slice(2, 8));

  if (joined) return <CodeRoom roomId={roomId} username={username} />;

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", textAlign: "center" }}>
      <h2>Collaborative Code Editor</h2>
      <input placeholder="Your name" value={username}
        onChange={(e) => setUsername(e.target.value)} /><br /><br />
      <input placeholder="Room ID" value={roomId}
        onChange={(e) => setRoomId(e.target.value)} />
      <button onClick={createRoom}>Generate</button><br /><br />
      <button disabled={!username || !roomId} onClick={() => setJoined(true)}>
        Join Room
      </button>
    </div>
  );
}