import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { socket } from "./socket";

export default function CodeRoom({ roomId, username }) {
  const [users, setUsers] = useState([]);
  const [language, setLanguage] = useState("javascript");
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState("vs-dark");
  const [typingUser, setTypingUser] = useState("");
  const typingTimeout = useRef(null);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const editorRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    socket.emit("join-room", { roomId, username });

    socket.on("users-update", setUsers);
    socket.on("user-typing", (name) => {
      setTypingUser(name);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setTypingUser(""), 1500);
    });

    return () => {
      socket.off("users-update");
      socket.off("user-typing");
    };
  }, [roomId, username]);

  useEffect(() => {
    return () => cleanupRef.current?.();
  }, []);

  const handleMount = (editor) => {
    cleanupRef.current?.();
    editorRef.current = editor;

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider("ws://localhost:1234", roomId, ydoc);
    const ytext = ydoc.getText("code");

    const binding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    );

    ytext.observe((event) => {
      if (event.transaction.local) socket.emit("typing", { roomId });
    });

    cleanupRef.current = () => {
      binding.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  };

  const getCode = () => (editorRef.current ? editorRef.current.getValue() : "");

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const extensions = { javascript: "js", python: "py", cpp: "cpp", java: "java" };
    const blob = new Blob([getCode()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code-${roomId}.${extensions[language]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runCode = async () => {
    const languageIds = { javascript: 63, python: 71, cpp: 54, java: 62 };
    setRunning(true);
    setOutput("Running...");
    try {
      const res = await fetch(
        "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_code: getCode(),
            language_id: languageIds[language],
          }),
        }
      );
      const data = await res.json();
      setOutput(
        data.stdout || data.stderr || data.compile_output || data.message || "No output"
      );
    } catch (err) {
      setOutput("Error: could not reach the code runner.");
    }
    setRunning(false);
  };

  const dark = theme === "vs-dark";

  return (
    <div>
      <div
        style={{
          padding: 10,
          background: dark ? "#222" : "#eee",
          color: dark ? "white" : "black",
        }}
      >
        Room: <b>{roomId}</b> | Users: {users.join(", ")} |{" "}
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>{" "}
        <button onClick={copyLink}>{copied ? "Copied!" : "Copy room link"}</button>{" "}
        <button onClick={downloadCode}>Download</button>{" "}
        <button onClick={() => setTheme(dark ? "light" : "vs-dark")}>
          {dark ? "Light mode" : "Dark mode"}
        </button>{" "}
        <button onClick={runCode} disabled={running}>
          {running ? "Running..." : "Run"}
        </button>
      </div>

      <div style={{ height: 22, fontSize: 13, padding: "2px 10px" }}>
        {typingUser && `${typingUser} is typing...`}
      </div>

      <Editor
        height="70vh"
        language={language}
        theme={theme}
        onMount={handleMount}
      />

      <pre
        style={{
          margin: 0,
          padding: 10,
          height: "15vh",
          overflow: "auto",
          background: dark ? "#111" : "#f5f5f5",
          color: dark ? "#0f0" : "#000",
        }}
      >
        {output || "Output will appear here"}
      </pre>
    </div>
  );
}