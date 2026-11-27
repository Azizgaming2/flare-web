import { useEffect, useRef, useState } from "react";
import ModeDropdown from "./ModeDropdown";
import ModelDropdown from "./ModelDropdown";
import { extractFile } from "../api/chatApi";
import { useSpeech } from "../hooks/useSpeech";

const ACCEPT =
  ".txt,.md,.csv,.tsv,.json,.xml,.html,.css,.js,.jsx,.ts,.py,.java,.c,.cpp,.cs,.sql,.log,.yml,.yaml,.pdf,.docx,.png,.jpg,.jpeg,.webp,.bmp";
const MAX_FILES = 2;
const VOICE_LANGS = ["az", "ru", "en", "tr"];
const ERROR_KEYS = {
  unsupported: "fileUnsupported",
  too_large: "fileTooBig",
  empty: "fileEmpty",
  ocr_unavailable: "fileOcrMissing",
};

function Svg({ children }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export default function MessageInput({
  onSend,
  onStop,
  isGenerating,
  mode,
  setMode,
  model,
  setModel,
  models,
  webSearch,
  setWebSearch,
  lang,
  loggedIn,
  t,
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const areaRef = useRef(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const menuRef = useRef(null);
  const baseRef = useRef("");
  const noticeTimer = useRef(null);
  const [voiceLang, setVoiceLang] = useState(() => {
    try {
      const saved = localStorage.getItem("flare_voice_lang");
      if (VOICE_LANGS.includes(saved)) return saved;
    } catch {}
    return VOICE_LANGS.includes(lang) ? lang : "en";
  });

  const speech = useSpeech(voiceLang, (transcript) => {
    const base = baseRef.current.replace(/\s+$/, "");
    const spoken = transcript.trim();
    setText(base ? `${base} ${spoken}` : spoken);
  });

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (speech.error) flash(speech.error === "not-allowed" ? t.micDenied : speech.error);
  }, [speech.error]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  function flash(message) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }

  function addFile(file) {
    const id = `${Date.now()}-${Math.random()}`;
    setFiles((prev) => [...prev, { id, name: file.name, status: "loading" }]);
    extractFile(file)
      .then((result) =>
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: "ready", text: result.text, truncated: result.truncated } : f))
        )
      )
      .catch((err) => {
        const key = ERROR_KEYS[err?.detail?.code];
        const message = err?.status === 401 ? t.fileLoginNeeded : t[key] || t.fileFailed;
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", error: message } : f)));
      });
  }

  function handlePick(e) {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!loggedIn) {
      flash(t.fileLoginNeeded);
      return;
    }
    picked.slice(0, Math.max(0, MAX_FILES - files.length)).forEach(addFile);
  }

  function cycleVoiceLang() {
    const next = VOICE_LANGS[(VOICE_LANGS.indexOf(voiceLang) + 1) % VOICE_LANGS.length];
    setVoiceLang(next);
    try {
      localStorage.setItem("flare_voice_lang", next);
    } catch {}
  }

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    baseRef.current = text;
    speech.start();
  }

  const loading = files.some((f) => f.status === "loading");
  const ready = files.filter((f) => f.status === "ready");
  const canSend = !isGenerating && !loading && (text.trim() || ready.length > 0);

  function handleSend() {
    if (!canSend) return;
    speech.stop();
    const content = text.trim() || t.summarizeFile;
    onSend(content, false, ready.map(({ name, text: fileText }) => ({ name, text: fileText })));
    setText("");
    setFiles([]);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="input-area">
      <div className="composer">
        {(files.length > 0 || webSearch) && (
          <div className="chip-row">
            {webSearch && (
              <span className="chip">
                <span>{t.webSearch}</span>
                <button onClick={() => setWebSearch(false)} aria-label="remove">
                  ×
                </button>
              </span>
            )}
            {files.map((f) => (
              <span key={f.id} className={`chip ${f.status === "error" ? "error" : ""}`} title={f.error || f.name}>
                <span>
                  {f.name}
                  {f.status === "loading" ? " ..." : ""}
                  {f.status === "ready" && f.truncated ? ` (${t.fileTruncated})` : ""}
                  {f.status === "error" ? ` - ${f.error}` : ""}
                </span>
                <button onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))} aria-label="remove">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="composer-row" data-tour="input">
          <div className="plus-wrap" ref={menuRef} data-tour="plus">
            <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)} title={t.attachFile}>
              <Svg>
                <path d="M12 5v14M5 12h14" />
              </Svg>
            </button>
            {menuOpen && (
  <div className="plus-menu">
    <button
      className="plus-item"
      style={{ "--i": 0 }}
      onClick={() => {
        setMenuOpen(false);
        camRef.current?.click();
      }}
    >
      <span className="plus-ico">
        <Svg>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </Svg>
      </span>
      <span className="plus-label">{t.takePhoto}</span>
    </button>
    <button
      className="plus-item"
      style={{ "--i": 1 }}
      onClick={() => {
        setMenuOpen(false);
        fileRef.current?.click();
      }}
    >
      <span className="plus-ico">
        <Svg>
          <path d="M21.4 11.1l-9.2 9.2a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" />
        </Svg>
      </span>
      <span className="plus-label">{t.attachFile}</span>
    </button>
    <button
      className={`plus-item ${webSearch ? "active" : ""}`}
      style={{ "--i": 2 }}
      onClick={() => {
        setWebSearch(!webSearch);
        setMenuOpen(false);
      }}
    >
      <span className="plus-ico">
        <Svg>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </Svg>
      </span>
      <span className="plus-label">{t.webSearch}</span>
      {webSearch && <span className="plus-badge">ON</span>}
    </button>
    {speech.supported && (
      <button className="plus-item" style={{ "--i": 3 }} onClick={cycleVoiceLang}>
        <span className="plus-ico">
          <Svg>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </Svg>
        </span>
        <span className="plus-label">{t.voiceLanguage}</span>
        <span className="plus-badge">{voiceLang.toUpperCase()}</span>
      </button>
    )}
  </div>
)}
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={handlePick} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={handlePick} />
          </div>

          <textarea
            ref={areaRef}
            className="message-input"
            rows={1}
            placeholder={t.sendPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {speech.supported && (
            <button
              className={`icon-btn ${speech.listening ? "on" : ""}`}
              data-tour="mic"
              onClick={toggleMic}
              title={speech.listening ? t.micStop : `${t.micStart} (${voiceLang.toUpperCase()})`}
            >
              <Svg>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </Svg>
            </button>
          )}

          {isGenerating ? (
            <button className="send-btn stop-btn" onClick={onStop} title={t.stop}>
              ■
            </button>
          ) : (
            <button className="send-btn" onClick={handleSend} disabled={!canSend}>
              ↑
            </button>
          )}
        </div>
      </div>

      <div className="composer-foot">
        <span className="composer-note">{notice || t.aiDisclaimer}</span>
        <div className="foot-controls">
          <ModelDropdown model={model} setModel={setModel} models={models} t={t} />
          <ModeDropdown mode={mode} setMode={setMode} t={t} />
        </div>
      </div>
    </div>
  );
}
