import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import Lobby from "./Lobby";
import CodeRoom from "./CodeRoom";

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const room = (p.get("room") || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  return { room, view: p.get("view") === "1" };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [, setTick] = useState(0);
  const [route, setRoute] = useState(readUrl);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const onPop = () => window.location.reload();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const storeKey = user ? `collab_recent_${user.uid}` : null;

  useEffect(() => {
    if (!storeKey) return;
    try {
      setRecent(JSON.parse(localStorage.getItem(storeKey)) || []);
    } catch (err) {
      setRecent([]);
    }
  }, [storeKey]);

  useEffect(() => {
    if (!storeKey || !route.room) return;
    setRecent((prev) => {
      const next = [
        { id: route.room, view: route.view, last: Date.now() },
        ...prev.filter((r) => !(r.id === route.room && r.view === route.view)),
      ].slice(0, 8);
      try {
        localStorage.setItem(storeKey, JSON.stringify(next));
      } catch (err) {
        // storage is full or blocked, the list just won't be remembered
      }
      return next;
    });
  }, [route.room, route.view, storeKey]);

  const go = (room, view = false) => {
    const url = room ? `?room=${room}${view ? "&view=1" : ""}` : window.location.pathname;
    window.history.pushState({}, "", url);
    setRoute({ room, view });
  };

  const createRoom = () => go(Math.random().toString(36).slice(2, 8));

  const joinFromText = (text) => {
    let t = text.trim();
    let view = false;
    if (t.includes("room=")) {
      try {
        const u = new URL(t, window.location.origin);
        t = u.searchParams.get("room") || "";
        view = u.searchParams.get("view") === "1";
      } catch (err) {
        return "That link doesn't look right.";
      }
    }
    const code = t.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!code) return "Enter a room code or paste a room link.";
    go(code, view);
    return "";
  };

  const removeRecent = (item) => {
    const next = recent.filter((r) => !(r.id === item.id && r.view === item.view));
    setRecent(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch (err) {
      // ignore
    }
  };

  if (!ready) return <div className="auth-loading">Loading...</div>;
  if (!user) return <Login onProfileUpdate={() => setTick((t) => t + 1)} />;

  const username =
    user.displayName || (user.email ? user.email.split("@")[0] : "Guest");

  if (!route.room) {
    return (
      <Lobby
        name={username}
        recent={recent}
        onCreate={createRoom}
        onJoin={joinFromText}
        onOpen={(r) => go(r.id, r.view)}
        onRemove={removeRecent}
        onLogout={() => signOut(auth)}
      />
    );
  }

  return (
    <CodeRoom
      key={route.room + (route.view ? "-view" : "")}
      roomId={route.room}
      username={username}
      readOnly={route.view}
      onLogout={() => signOut(auth)}
      onLeave={() => {
        window.location.href = window.location.pathname;
      }}
    />
  );
}