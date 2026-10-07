import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { socket } from "./socket";

export default function CodeRoom({ roomId, username }) {
  const [code, setCode] = useState("");
  const [users, setUsers] = useState([]);
  const [language, setLanguage] = useState("javascript");
  const [copied, setCopied] = useState(false);
  const codeRef = useRef("");

  useEffect(() => {
    socket.emit("join-room", { roomId, username });

    socket.on("init-code", (c) => { codeRef.current = c; setCode(c); });
    socket.on("code-update", (c) => { codeRef.current = c; setCode(c); });
    socket.on("users-update", setUsers);

    return () => {
      socket.off("init-code");
      socket.off("code-update");
      socket.off("users-update");
    };
  }, [roomId, username]);

  const handleChange = (value) => {
    if (value === codeRef.current) return; // ignore updates that came from others
    codeRef.current = value;
    setCode(value);
    socket.emit("code-change", { roomId, code: value });
  };
  const copyLink = async () => {
  await navigator.clipboard.writeText(window.location.href);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};

  return (
    <div>
      <div style={{ padding: 10, background: "#222", color: "white" }}>
        Room: <b>{roomId}</b> | Users: {users.join(", ")} |{" "}
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>
        {" "}
<button onClick={copyLink}>{copied ? "Copied!" : "Copy room link"}</button>
      </div>
      <Editor
        height="90vh"
        language={language}
        value={code}
        onChange={handleChange}
        theme="vs-dark"
      />
    </div>
  );
}