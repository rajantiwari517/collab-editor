import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { socket, SERVER_URL } from "./socket";
import "./CodeRoom.css";

export default function CodeRoom({ roomId, username }) {
  const [users, setUsers] = useState([]);
  const [language, setLanguage] = useState("javascript");
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
 const [theme, setTheme] = useState("light");
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
    const provider = new WebsocketProvider(
  SERVER_URL.replace(/^http/, "ws") + "/yjs",
  roomId,
  ydoc
);
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
const shareLink = window.location.href;
const shareText = "Join my coding room on CollabCode: ";

const openShare = (url) => {
  window.open(url, "_blank", "noopener,noreferrer");
  setShareOpen(false);
};

const nativeShare = async () => {
  try {
    await navigator.share({ title: "CollabCode", text: shareText, url: shareLink });
  } catch (err) {
    // the person closed the share sheet, nothing to do
  }
  setShareOpen(false);
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
    <div className={`app ${dark ? "dark" : "light"}`}>
      <div className="header">
        <span className="brand">CollabCode</span>
        <span className="room">Room {roomId}</span>
        <div className="avatars">
          {users.map((u, i) => (
            <span key={i} className={`avatar c${i % 4}`} title={u}>
              {u[0] + u.slice(-2)}
            </span>
          ))}
        </div>

        <div className="spacer" />

        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>
        <div className="share-wrap">
  <button onClick={() => setShareOpen(!shareOpen)}>Share</button>
  {shareOpen && (
    <div className="share-menu">
      <button
        onClick={() =>
          openShare("https://wa.me/?text=" + encodeURIComponent(shareText + shareLink))
        }
      >
        WhatsApp
      </button>
      <button
        onClick={() =>
          openShare(
            "https://t.me/share/url?url=" +
              encodeURIComponent(shareLink) +
              "&text=" +
              encodeURIComponent(shareText)
          )
        }
      >
        Telegram
      </button>
      <button
        onClick={() =>
          openShare(
            "https://twitter.com/intent/tweet?text=" +
              encodeURIComponent(shareText) +
              "&url=" +
              encodeURIComponent(shareLink)
          )
        }
      >
        X (Twitter)
      </button>
      <button
        onClick={() =>
          openShare(
            "mailto:?subject=" +
              encodeURIComponent("Join my coding room") +
              "&body=" +
              encodeURIComponent(shareText + shareLink)
          )
        }
      >
        Email
      </button>
      <button onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
      {navigator.share && <button onClick={nativeShare}>More...</button>}
    </div>
  )}
</div>
        <button onClick={downloadCode}>Download</button>
        <button onClick={() => setTheme(dark ? "light" : "vs-dark")}>
          {dark ? "Light" : "Dark"}
        </button>
        <button className="primary" onClick={runCode} disabled={running}>
          {running ? "Running..." : "Run code"}
        </button>
      </div>

      <div className="typing">{typingUser && `${typingUser} is typing...`}</div>

      <div className="editor-card">
        <Editor
          height="55vh"
          language={language}
          theme={theme}
          onMount={handleMount}
          options={{
            fontSize: 14,
            fontFamily: "Fira Code, monospace",
            minimap: { enabled: false },
            padding: { top: 8 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      <div className="output-label">Output</div>
      <pre className="output">{output || "Run your code to see output here"}</pre>
    </div>
  );
}