import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./Login";
import CodeRoom from "./CodeRoom";

function getRoomId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get("room");
  if (!id) {
    id = Math.random().toString(36).slice(2, 8);
    params.set("room", id);
    window.history.replaceState({}, "", "?" + params.toString());
  }
  return id;
}

const roomId = getRoomId();

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
  return onAuthStateChanged(auth, (u) => {
    console.log("AUTH STATE:", u ? u.email : "not logged in");
    setUser(u);
    setReady(true);
  });
}, []);

  if (!ready) return <div className="auth-loading">Loading...</div>;
  if (!user) return <Login onProfileUpdate={() => setTick((t) => t + 1)} />;

  const username =
    user.displayName || (user.email ? user.email.split("@")[0] : "Guest");

  return (
    <CodeRoom roomId={roomId} username={username} onLogout={() => signOut(auth)} />
  );
}