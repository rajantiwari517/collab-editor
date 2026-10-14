import { useState } from "react";
import "./Lobby.css";

function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

export default function Lobby({ name, recent, onCreate, onJoin, onOpen, onRemove, onLogout }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setError(onJoin(code));
  };

  return (
    <div className="lobby-page">
      <div className="lobby-top">
        <span className="lobby-brand">CollabCode</span>
        <div className="lobby-spacer" />
        <span className="lobby-user">{name}</span>
        <button className="lobby-btn small" onClick={onLogout}>
          Log out
        </button>
      </div>

      <div className="lobby-body">
        <div className="lobby-card">
          <h2>Start a new room</h2>
          <p>Create a fresh room and share the link with your team.</p>
          <button className="lobby-btn" onClick={onCreate}>
            New room
          </button>
        </div>

        <div className="lobby-card">
          <h2>Join a room</h2>
          <p>Type a room code, or paste a room link.</p>
          <form onSubmit={submit} className="lobby-row">
            <input
              className="lobby-input"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              placeholder="e.g. k3x9ab"
            />
            <button className="lobby-btn" type="submit">
              Join
            </button>
          </form>
          {error && <div className="lobby-error">{error}</div>}
        </div>

        <div className="lobby-card">
          <h2>Recent rooms</h2>
          {recent.length === 0 && <p>Rooms you open will show up here.</p>}
          {recent.map((r) => (
            <div className="recent-row" key={r.id + (r.view ? "v" : "")}>
              <div className="recent-info">
                <b>{r.id}</b>
                {r.view && <span className="recent-tag">View only</span>}
                <span className="recent-time">{timeAgo(r.last)}</span>
              </div>
              <button className="lobby-btn small" onClick={() => onOpen(r)}>
                Open
              </button>
              <button className="lobby-btn small ghost" onClick={() => onRemove(r)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}