import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import { socket, SERVER_URL } from "./socket";
import RoomPanel from "./RoomPanel";
import "./CodeRoom.css";

const LANGS = {
  javascript: { label: "JavaScript", ext: "js", id: 63, base: "script", monaco: "javascript" },
  typescript: { label: "TypeScript", ext: "ts", id: 74, base: "script", monaco: "typescript" },
  python: { label: "Python", ext: "py", id: 71, base: "script", monaco: "python" },
  java: { label: "Java", ext: "java", id: 62, base: "Main", monaco: "java" },
  cpp: { label: "C++", ext: "cpp", id: 54, base: "main", monaco: "cpp" },
  c: { label: "C", ext: "c", id: 50, base: "main", monaco: "c" },
  csharp: { label: "C#", ext: "cs", id: 51, base: "Program", monaco: "csharp" },
  go: { label: "Go", ext: "go", id: 60, base: "main", monaco: "go" },
  rust: { label: "Rust", ext: "rs", id: 73, base: "main", monaco: "rust" },
  php: { label: "PHP", ext: "php", id: 68, base: "index", monaco: "php" },
  ruby: { label: "Ruby", ext: "rb", id: 72, base: "script", monaco: "ruby" },
  kotlin: { label: "Kotlin", ext: "kt", id: 78, base: "Main", monaco: "kotlin" },
  sql: { label: "SQL", ext: "sql", id: 82, base: "query", monaco: "sql" },
};
const EXT_TO_LANG = {
  js: "javascript", ts: "typescript", py: "python", java: "java", cpp: "cpp",
  c: "c", cs: "csharp", go: "go", rs: "rust", php: "php", rb: "ruby",
  kt: "kotlin", sql: "sql",
};
const langOf = (fileName) => EXT_TO_LANG[fileName.split(".").pop()] || "javascript";

const TEMPLATES = {
  javascript: '// console.log("Hello, World!");\n',
  typescript: '// console.log("Hello, World!");\n',
  python: '# print("Hello, World!")\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        // System.out.println("Hello, World!");\n    }\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // cout << "Hello, World!" << endl;\n    return 0;\n}\n',
  c: '#include <stdio.h>\n\nint main() {\n    // printf("Hello, World!\\n");\n    return 0;\n}\n',
  csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        // Console.WriteLine("Hello, World!");\n    }\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}\n',
  rust: 'fn main() {\n    // println!("Hello, World!");\n}\n',
  php: '<?php\n// echo "Hello, World!";\n',
  ruby: '# puts "Hello, World!"\n',
  kotlin: 'fun main() {\n    // println("Hello, World!")\n}\n',
  sql: '-- SELECT "Hello, World!";\n',
};

const JS_SNIPS = [
  ["log", "console.log($1);", "console.log"],
  ["fn", "function ${1:name}($2) {\n\t$0\n}", "function"],
  ["arrow", "const ${1:name} = ($2) => {\n\t$0\n};", "arrow function"],
  ["for", "for (let i = 0; i < ${1:n}; i++) {\n\t$0\n}", "for loop"],
  ["foreach", "${1:arr}.forEach((${2:item}) => {\n\t$0\n});", "forEach loop"],
  ["map", "${1:arr}.map((${2:item}) => $0);", "map"],
  ["if", "if ($1) {\n\t$0\n}", "if statement"],
  ["try", "try {\n\t$0\n} catch (err) {\n\tconsole.error(err);\n}", "try / catch"],
  ["fetch", "const res = await fetch(${1:url});\nconst data = await res.json();", "fetch json"],
];

const SNIPPETS = {
  javascript: JS_SNIPS,
  typescript: [
    ...JS_SNIPS,
    ["interface", "interface ${1:Name} {\n\t$0\n}", "interface"],
    ["type", "type ${1:Name} = $0;", "type alias"],
  ],
  python: [
    ["def", "def ${1:name}($2):\n\t$0", "function"],
    ["for", "for ${1:i} in range(${2:n}):\n\t$0", "for loop"],
    ["forin", "for ${1:item} in ${2:items}:\n\t$0", "for each"],
    ["while", "while ${1:condition}:\n\t$0", "while loop"],
    ["if", "if $1:\n\t$0", "if statement"],
    ["ifelse", "if $1:\n\t$2\nelse:\n\t$0", "if / else"],
    ["class", "class ${1:Name}:\n\tdef __init__(self$2):\n\t\t$0", "class"],
    ["main", 'if __name__ == "__main__":\n\t$0', "main guard"],
    ["try", "try:\n\t$1\nexcept ${2:Exception} as e:\n\t$0", "try / except"],
    ["input", "${1:x} = input($2)", "read input"],
    ["with", "with open(${1:path}) as f:\n\t$0", "open a file"],
  ],
  java: [
    ["main", "public static void main(String[] args) {\n\t$0\n}", "main method"],
    ["sout", "System.out.println($1);", "print a line"],
    ["fori", "for (int i = 0; i < ${1:n}; i++) {\n\t$0\n}", "for loop"],
    ["foreach", "for (${1:String} ${2:item} : ${3:items}) {\n\t$0\n}", "for each"],
    ["while", "while (${1:condition}) {\n\t$0\n}", "while loop"],
    ["if", "if ($1) {\n\t$0\n}", "if statement"],
    ["class", "public class ${1:Main} {\n\t$0\n}", "class"],
    ["method", "public ${1:void} ${2:name}($3) {\n\t$0\n}", "method"],
    ["try", "try {\n\t$0\n} catch (${1:Exception} e) {\n\te.printStackTrace();\n}", "try / catch"],
    ["scanner", "Scanner sc = new Scanner(System.in);", "read input"],
    ["list", "List<${1:String}> ${2:list} = new ArrayList<>();", "ArrayList"],
    ["map", "Map<${1:String}, ${2:Integer}> ${3:map} = new HashMap<>();", "HashMap"],
  ],
  cpp: [
    ["main", "int main() {\n\t$0\n\treturn 0;\n}", "main function"],
    ["cout", "cout << $1 << endl;", "print a line"],
    ["cin", "cin >> $1;", "read input"],
    ["for", "for (int i = 0; i < ${1:n}; i++) {\n\t$0\n}", "for loop"],
    ["while", "while (${1:condition}) {\n\t$0\n}", "while loop"],
    ["if", "if ($1) {\n\t$0\n}", "if statement"],
    ["inc", "#include <${1:iostream}>", "include"],
    ["vector", "vector<${1:int}> ${2:v};", "vector"],
    ["class", "class ${1:Name} {\npublic:\n\t$0\n};", "class"],
    ["struct", "struct ${1:Name} {\n\t$0\n};", "struct"],
  ],
  c: [
    ["main", "int main() {\n\t$0\n\treturn 0;\n}", "main function"],
    ["printf", 'printf("${1:%d}\\n"${2:, x});', "print"],
    ["scanf", 'scanf("${1:%d}", &${2:x});', "read input"],
    ["for", "for (int i = 0; i < ${1:n}; i++) {\n\t$0\n}", "for loop"],
    ["while", "while (${1:condition}) {\n\t$0\n}", "while loop"],
    ["if", "if ($1) {\n\t$0\n}", "if statement"],
    ["inc", "#include <${1:stdio.h}>", "include"],
    ["struct", "struct ${1:Name} {\n\t$0\n};", "struct"],
  ],
  csharp: [
    ["main", "static void Main() {\n\t$0\n}", "main method"],
    ["cw", "Console.WriteLine($1);", "print a line"],
    ["cr", "var ${1:line} = Console.ReadLine();", "read input"],
    ["for", "for (int i = 0; i < ${1:n}; i++) {\n\t$0\n}", "for loop"],
    ["foreach", "foreach (var ${1:item} in ${2:items}) {\n\t$0\n}", "for each"],
    ["if", "if ($1) {\n\t$0\n}", "if statement"],
    ["class", "class ${1:Name} {\n\t$0\n}", "class"],
    ["list", "var ${1:list} = new List<${2:int}>();", "List"],
  ],
  go: [
    ["main", "func main() {\n\t$0\n}", "main function"],
    ["fmt", "fmt.Println($1)", "print a line"],
    ["for", "for i := 0; i < ${1:n}; i++ {\n\t$0\n}", "for loop"],
    ["forr", "for ${1:i}, ${2:v} := range ${3:items} {\n\t$0\n}", "range loop"],
    ["if", "if $1 {\n\t$0\n}", "if statement"],
    ["func", "func ${1:name}($2) ${3:int} {\n\t$0\n}", "function"],
    ["struct", "type ${1:Name} struct {\n\t$0\n}", "struct"],
    ["err", "if err != nil {\n\treturn err\n}", "error check"],
  ],
  rust: [
    ["main", "fn main() {\n\t$0\n}", "main function"],
    ["println", 'println!("${1:{}}"${2:, x});', "print a line"],
    ["fn", "fn ${1:name}($2) -> ${3:i32} {\n\t$0\n}", "function"],
    ["for", "for ${1:i} in 0..${2:n} {\n\t$0\n}", "for loop"],
    ["if", "if $1 {\n\t$0\n}", "if statement"],
    ["let", "let mut ${1:x} = $0;", "mutable variable"],
    ["struct", "struct ${1:Name} {\n\t$0\n}", "struct"],
    ["match", "match ${1:value} {\n\t$0\n}", "match"],
  ],
  php: [
    ["echo", "echo $1;", "print"],
    ["fn", "function ${1:name}($2) {\n\t$0\n}", "function"],
    ["for", "for ($i = 0; $i < ${1:n}; $i++) {\n\t$0\n}", "for loop"],
    ["foreach", "foreach ($${1:items} as $${2:item}) {\n\t$0\n}", "for each"],
    ["if", "if ($1) {\n\t$0\n}", "if statement"],
    ["class", "class ${1:Name} {\n\t$0\n}", "class"],
  ],
  ruby: [
    ["puts", "puts $1", "print a line"],
    ["def", "def ${1:name}($2)\n\t$0\nend", "method"],
    ["each", "${1:items}.each do |${2:item}|\n\t$0\nend", "each loop"],
    ["times", "${1:n}.times do |i|\n\t$0\nend", "times loop"],
    ["if", "if $1\n\t$0\nend", "if statement"],
    ["class", "class ${1:Name}\n\t$0\nend", "class"],
    ["gets", "${1:line} = gets.chomp", "read input"],
  ],
  kotlin: [
    ["main", "fun main() {\n\t$0\n}", "main function"],
    ["println", "println($1)", "print a line"],
    ["fun", "fun ${1:name}($2): ${3:Int} {\n\t$0\n}", "function"],
    ["for", "for (${1:i} in 0 until ${2:n}) {\n\t$0\n}", "for loop"],
    ["if", "if ($1) {\n\t$0\n}", "if statement"],
    ["class", "class ${1:Name}($2) {\n\t$0\n}", "class"],
    ["when", "when (${1:value}) {\n\t$0\n}", "when"],
  ],
  sql: [
    ["select", "SELECT ${1:*}\nFROM ${2:table}\nWHERE ${3:condition};", "select query"],
    ["create", "CREATE TABLE ${1:name} (\n\t${2:id} INTEGER PRIMARY KEY,\n\t$0\n);", "create table"],
    ["insert", "INSERT INTO ${1:table} (${2:columns}) VALUES (${3:values});", "insert row"],
    ["update", "UPDATE ${1:table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};", "update rows"],
    ["delete", "DELETE FROM ${1:table} WHERE ${2:condition};", "delete rows"],
    ["join", "SELECT *\nFROM ${1:a}\nJOIN ${2:b} ON ${1:a}.${3:id} = ${2:b}.${4:id};", "join"],
  ],
};
const OLD_STARTERS = [
  'console.log("Hello, World!");',
  'print("Hello, World!")',
  '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
  'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
];
let snippetsRegistered = false;

function registerSnippets(monaco) {
  if (snippetsRegistered) return;
  snippetsRegistered = true;
  Object.entries(SNIPPETS).forEach(([lang, items]) => {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: items.map(([label, insertText, detail]) => ({
            label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText,
            insertTextRules:
              monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail,
            range,
          })),
        };
      },
    });
  });
}

const COLORS = ["#2557d6", "#e8590c", "#1a7f4b", "#7a3ec8", "#d6336c", "#0b7285"];
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : "#2557d6");

function updateCursorStyles(awareness, styleEl) {
  let css = "";
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID || !state.user) return;
    const color = safeColor(state.user.color);
    const name = String(state.user.name || "Guest").slice(0, 24);
    css += `
.yRemoteSelection-${clientId} { background-color: ${color}33; }
.yRemoteSelectionHead-${clientId} { position: absolute; border-left: 2px solid ${color}; height: 100%; box-sizing: border-box; }
.yRemoteSelectionHead-${clientId}::after { content: ${JSON.stringify(name)}; position: absolute; top: -20px; left: -2px; padding: 1px 6px; border-radius: 4px; background: ${color}; color: #fff; font-size: 11px; font-weight: 700; white-space: nowrap; font-family: sans-serif; pointer-events: none; }`;
  });
  styleEl.textContent = css;
}

export default function CodeRoom({ roomId, username, readOnly, onLogout, onLeave }) {
  const [users, setUsers] = useState([]);
  const [theme, setTheme] = useState("light");
  const [typingUser, setTypingUser] = useState("");
  const typingTimeout = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState("");
  const [newOpen, setNewOpen] = useState(false);
    const [suggest, setSuggest] = useState(true);

  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState("");
  const [filesTick, setFilesTick] = useState(0);
  const [shared, setShared] = useState(null);
  
  const [running, setRunning] = useState(false);
  const [synced, setSynced] = useState(false);
  const [ready, setReady] = useState(false);

  const editorRef = useRef(null);
  const docRef = useRef(null);
  const bindingRef = useRef(null);
  const boundTextRef = useRef(null);
  const cursorStyleRef = useRef(null);

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
    return () => {
      if (bindingRef.current) bindingRef.current.destroy();
      const d = docRef.current;
      if (d) {
        d.provider.destroy();
        d.ydoc.destroy();
      }
      if (cursorStyleRef.current) cursorStyleRef.current.remove();
    };
  }, []);

  const handleMount = (editor, monaco) => {
    registerSnippets(monaco);
    editorRef.current = editor;

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(
      SERVER_URL.replace(/^http/, "ws") + "/yjs",
      roomId,
      ydoc
    );
    const filesMap = ydoc.getMap("files");
    const metaMap = ydoc.getMap("meta");
    docRef.current = { ydoc, provider, filesMap, metaMap };

    provider.awareness.setLocalStateField("user", {
      name: username.slice(0, 24),
      color: COLORS[provider.awareness.clientID % COLORS.length],
    });

    const styleEl = document.createElement("style");
    document.head.appendChild(styleEl);
    cursorStyleRef.current = styleEl;
    provider.awareness.on("change", () =>
      updateCursorStyles(provider.awareness, styleEl)
    );

    const refreshFiles = () => {
      const names = Array.from(filesMap.keys()).sort();
      setFiles(names);
      setActiveFile((cur) => (names.includes(cur) ? cur : names[0] || ""));
      setFilesTick((t) => t + 1);
    };
    const refreshMeta = () => setShared(metaMap.get("output") || null);
    filesMap.observe(refreshFiles);
    metaMap.observe(refreshMeta);

    provider.on("sync", (isSynced) => {
      if (!isSynced) return;
      if (filesMap.size === 0 && !readOnly) {
        const t = new Y.Text();
        ydoc.transact(() => {
          filesMap.set("main.js", t);
          t.insert(0, TEMPLATES.javascript);
        });
      }
      refreshFiles();
      refreshMeta();
      setSynced(true);
    });

    ydoc.on("update", (update, origin) => {
      if (origin instanceof MonacoBinding) socket.emit("typing", { roomId });
    });

    setReady(true);
  };

  useEffect(() => {
    const d = docRef.current;
    const editor = editorRef.current;
    if (!ready || !d || !editor || !activeFile) return;
    const ytext = d.filesMap.get(activeFile);
    if (!ytext) return;
    if (boundTextRef.current === ytext && bindingRef.current) return;
    if (bindingRef.current) bindingRef.current.destroy();
    bindingRef.current = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      d.provider.awareness
    );
    boundTextRef.current = ytext;
  }, [ready, activeFile, filesTick]);

  const createFile = (key) => {
    const d = docRef.current;
    if (!d || readOnly) return;
    const L = LANGS[key];
    let name = `${L.base}.${L.ext}`;
    let n = 2;
    while (d.filesMap.has(name)) {
      name = `${L.base}${n}.${L.ext}`;
      n++;
    }
    const t = new Y.Text();
    d.ydoc.transact(() => {
      d.filesMap.set(name, t);
      t.insert(0, TEMPLATES[key]);
    });
    setActiveFile(name);
    setNewOpen(false);
  };

  const deleteFile = (name) => {
    const d = docRef.current;
    if (!d || readOnly) return;
    if (!window.confirm(`Delete ${name} for everyone in this room?`)) return;
    d.filesMap.delete(name);
  };

  const runCode = async () => {
    const d = docRef.current;
    if (!d || readOnly || !activeFile) return;
    const ytext = d.filesMap.get(activeFile);
    if (!ytext) return;
    const L = LANGS[langOf(activeFile)];
    setRunning(true);
    d.metaMap.set("output", {
      text: "Running...",
      by: username,
      file: activeFile,
      at: Date.now(),
    });
    let text;
    try {
      const res = await fetch(
        "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_code: ytext.toString(),
            language_id: L.id,
            
          }),
        }
      );
      const data = await res.json();
      text =
        data.stdout || data.stderr || data.compile_output || data.message || "No output";
    } catch (err) {
      text = "Error: could not reach the code runner.";
    }
    d.metaMap.set("output", { text, by: username, file: activeFile, at: Date.now() });
    setRunning(false);
  };
  const changeLanguage = (key) => {
  const d = docRef.current;
  if (!d || readOnly || !activeFile) return;
  if (langOf(activeFile) === key) return;
  const old = d.filesMap.get(activeFile);
  if (!old) return;

  const clean = (s) => s.replace(/\r/g, "").trim();
  const current = clean(old.toString());
  const known = [...Object.values(TEMPLATES), ...OLD_STARTERS].map(clean);
  const content =
    current === "" || known.includes(current) ? TEMPLATES[key] : old.toString();

  const L = LANGS[key];
  let name = `${L.base}.${L.ext}`;
  let n = 2;
  while (d.filesMap.has(name)) {
    name = `${L.base}${n}.${L.ext}`;
    n++;
  }
  const t = new Y.Text();
  d.ydoc.transact(() => {
    d.filesMap.delete(activeFile);
    d.filesMap.set(name, t);
    t.insert(0, content);
  });
  setActiveFile(name);
};
  const downloadCode = () => {
    const d = docRef.current;
    const t = d && d.filesMap.get(activeFile);
    const blob = new Blob([t ? t.toString() : ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile || `code-${roomId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const base = window.location.origin + window.location.pathname;
  const editLink = `${base}?room=${roomId}`;
  const viewLink = `${editLink}&view=1`;
  const mainLink = readOnly ? viewLink : editLink;
  const shareText = "Join my coding room on CollabCode: ";

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch (err) {
      window.prompt("Copy this link:", text);
    }
  };

  const openShare = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setShareOpen(false);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "CollabCode", text: shareText, url: mainLink });
    } catch (err) {
      // the person closed the share sheet
    }
    setShareOpen(false);
  };

  const dark = theme === "vs-dark";
  const statusLine = !synced
    ? "Connecting to the room..."
    : files.length === 0
    ? "This room is empty. Ask the owner to add some code."
    : typingUser
    ? `${typingUser} is typing...`
    : "";

  return (
    <div className={`app ${dark ? "dark" : "light"}`}>
      <div className="header">
        <span className="brand">CollabCode</span>
        <span className="room">Room {roomId}</span>
        {readOnly && <span className="view-badge">View only</span>}
        <div className="avatars">
          {users.map((u, i) => (
            <span key={i} className={`avatar c${i % 4}`} title={u}>
              {u}
            </span>
          ))}
        </div>

        <div className="spacer" />
          <select
  value={activeFile ? langOf(activeFile) : "javascript"}
  onChange={(e) => changeLanguage(e.target.value)}
  disabled={readOnly || !activeFile}
>
  {Object.entries(LANGS).map(([key, L]) => (
    <option key={key} value={key}>
      {L.label}
    </option>
  ))}
</select>
        <div className="share-wrap">
                  <button onClick={() => setSuggest(!suggest)}>
          Suggestions: {suggest ? "On" : "Off"}
        </button>
          <button onClick={() => setShareOpen(!shareOpen)}>Share</button>
          {shareOpen && (
            <div className="share-menu">
              <button
                onClick={() =>
                  openShare("https://wa.me/?text=" + encodeURIComponent(shareText + mainLink))
                }
              >
                WhatsApp
              </button>
              <button
                onClick={() =>
                  openShare(
                    "https://t.me/share/url?url=" +
                      encodeURIComponent(mainLink) +
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
                      encodeURIComponent(mainLink)
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
                      encodeURIComponent(shareText + mainLink)
                  )
                }
              >
                Email
              </button>
              {!readOnly && (
                <button onClick={() => copy(editLink, "edit")}>
                  {copied === "edit" ? "Copied!" : "Copy edit link"}
                </button>
              )}
              <button onClick={() => copy(viewLink, "view")}>
                {copied === "view" ? "Copied!" : "Copy view-only link"}
              </button>
              {navigator.share && <button onClick={nativeShare}>More...</button>}
            </div>
          )}
        </div>

        <button onClick={downloadCode}>Download</button>
        <button onClick={() => setTheme(dark ? "light" : "vs-dark")}>
          {dark ? "Light" : "Dark"}
        </button>
        {!readOnly && (
          <button className="primary" onClick={runCode} disabled={running || !activeFile}>
            {running ? "Running..." : "Run code"}
          </button>
        )}
        <button onClick={onLeave}>Rooms</button>
        <button onClick={onLogout}>Log out</button>
      </div>

      <div className="typing">{statusLine}</div>

      <div className="tabs">
        {files.map((f) => (
          <div key={f} className={`tab ${f === activeFile ? "active" : ""}`}>
            <button className="tab-name" onClick={() => setActiveFile(f)}>
              {f}
            </button>
            {!readOnly && files.length > 1 && (
              <button
                className="tab-x"
                aria-label={`Delete ${f}`}
                onClick={() => deleteFile(f)}
              >
                x
              </button>
            )}
          </div>
        ))}
        {!readOnly && synced && (
          <div className="share-wrap">
            <button className="tab-add" onClick={() => setNewOpen(!newOpen)}>
              + New file
            </button>
            {newOpen && (
              <div className="share-menu left">
                {Object.entries(LANGS).map(([key, L]) => (
                  <button key={key} onClick={() => createFile(key)}>
                    {L.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="editor-card">
        <Editor
          height="50vh"
          language={activeFile ? LANGS[langOf(activeFile)].monaco : "javascript"}
          theme={theme}
          onMount={handleMount}
          options={{
            readOnly,
            fontSize: 14,
            fontFamily: "Fira Code, monospace",
            minimap: { enabled: false },
            padding: { top: 8 },
            scrollBeyondLastLine: false,
             quickSuggestions: suggest ? { other: true, comments: false, strings: true } : false,
            suggestOnTriggerCharacters: suggest,
            snippetSuggestions: "top",
            wordBasedSuggestions: suggest,
            parameterHints: { enabled: suggest },
            acceptSuggestionOnEnter: "on",
            tabCompletion: "on",
          }}
        />
      </div>

   

      <div className="output-label">
        Output
        {shared ? ` - ${shared.file}, run by ${shared.by}` : ""}
      </div>
      <pre className="output">
        {shared ? shared.text : "Run your code to see output here"}
      </pre>

      <RoomPanel roomId={roomId} />
    </div>
  );
}