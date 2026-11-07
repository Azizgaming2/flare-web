import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "../Markdown";
import ClassAttachment from "./ClassAttachment";
import { useSpeech } from "../../hooks/useSpeech";
import { uploadClassFile } from "../../api/classApi";

const MAX_BYTES = 50 * 1024 ** 2;

function clock(ts) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ClassChat({ code, msgs, isHost, lang, s, onSend, onNotice }) {
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [markdown, setMarkdown] = useState(false);
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const photoRef = useRef(null);
  const fileRef = useRef(null);
  const baseRef = useRef("");
  const labels = useMemo(() => ({ copy: s.copy, copied: s.copied }), [s]);

  const speech = useSpeech(lang, (transcript) => {
    const base = baseRef.current.replace(/\s+$/, "");
    const spoken = transcript.trim();
    setText(base ? `${base} ${spoken}` : spoken);
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  function submit() {
    const value = text.trim();
    if (!value) return;
    if (speech.listening) speech.stop();
    onSend(value, markdown);
    setText("");
  }

  async function upload(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      onNotice("too_big");
      return;
    }
    setBusy(true);
    try {
      await uploadClassFile(code, file);
    } catch (err) {
      onNotice(err.code || "upload_failed");
    } finally {
      setBusy(false);
    }
  }

  function pick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    upload(file);
  }

  function toggleVoice() {
    setMenu(false);
    if (speech.listening) {
      speech.stop();
      return;
    }
    baseRef.current = text;
    speech.start();
  }

  return (
    <div className="cl-chat-inner">
      <div className="cl-msgs">
        {msgs.map((m) => (
          <div key={m.id} className={`cl-msg${m.role === "host" ? " host" : ""}`}>
            <div className="cl-msg-head">
              <b>{m.name}</b>
              {m.role === "host" && <span className="cl-badge">{s.teacher}</span>}
              <time>{clock(m.ts)}</time>
            </div>
            {m.file && <ClassAttachment code={code} file={m.file} />}
            {m.text && (m.md ? <Markdown content={m.text} labels={labels} /> : <p className="cl-text">{m.text}</p>)}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {busy && <div className="cl-uploading">{s.uploading}</div>}

      <div className="cl-composer" onClick={(e) => e.stopPropagation()}>
        {menu && (
          <div className="cl-menu">
            <button type="button" onClick={() => { setMenu(false); photoRef.current.click(); }}>
              {s.photo}
            </button>
            {isHost && (
              <button type="button" onClick={() => { setMenu(false); fileRef.current.click(); }}>
                {s.file}
              </button>
            )}
            {speech.supported && (
              <button type="button" onClick={toggleVoice}>
                {speech.listening ? s.voiceStop : s.voice}
              </button>
            )}
            <button type="button" onClick={() => setMarkdown(!markdown)}>
              {s.markdown}
              <span className="cl-menu-state">{markdown ? s.on : s.off}</span>
            </button>
          </div>
        )}
        <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={pick} />
        <input ref={fileRef} type="file" hidden onChange={pick} />
        <button type="button" className="cl-plus" onClick={() => setMenu(!menu)} aria-label="+">
          +
        </button>
        <textarea
          rows={1}
          value={text}
          placeholder={s.typeMessage}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="button" className="cl-btn pri" onClick={submit} disabled={!text.trim()}>
          {s.send}
        </button>
      </div>
    </div>
  );
}
