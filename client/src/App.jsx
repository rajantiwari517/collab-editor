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
const username = "User" + Math.floor(Math.random() * 100);

export default function App() {
  return <CodeRoom roomId={roomId} username={username} />;
}