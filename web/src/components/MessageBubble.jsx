import { useMemo, useState } from "react";
import Markdown from "./Markdown";
import { formatDuration, normalizeAssistant } from "../utils";

const UP = "M7 10v11H3V10zM7 10l4-8c1.7 0 3 1.3 3 3v3h5.5a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7H7";
const REFRESH = "M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5";
const REASONS = ["wrong", "unclear", "language", "other"];
const REASON_KEYS = { wrong: "reasonWrong", unclear: "reasonUnclear", language: "reasonLanguage", other: "reasonOther" };

function Icon({ d, className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default function MessageBubble({
  role,
  content,
  avatarUrl,
  attachments,
  index,
  showCopy,
  showRegenerate,
  onRegenerate,
  onFeedback,
  thinkingMs,
  memoryUpdated,
  storageFull,
  loginRequired,
  onLogIn,
  t,
}) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState(null);
  const [reason, setReason] = useState(null);
  const text = isUser ? content : normalizeAssistant(content);
  const labels = useMemo(() => ({ copy: t.copy, copied: t.copied }), [t]);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleVote(next) {
    const value = vote === next ? null : next;
    setVote(value);
    setReason(null);
    onFeedback?.(index, value || "none", null);
  }

  function handleReason(next) {
    setReason(next);
    onFeedback?.(index, "down", next);
  }

  if (isUser) {
    return (
      <div className="message-row user">
        <div className="avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : "U"}
        </div>
        <div className="message-bubble user">
          {attachments?.length > 0 && (
            <div className="bubble-files">
              {attachments.map((f, i) => (
                <span key={`${f.name}-${i}`} className="chip">
                  <span>{f.name}</span>
                </span>
              ))}
            </div>
          )}
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="message-row assistant">
      <div className="assistant-content">
        {(memoryUpdated || storageFull || thinkingMs != null) && (
          <div className="message-meta">
            {memoryUpdated && <span className="meta-chip">{t.memoryUpdated}</span>}
            {storageFull && <span className="meta-chip warn">{t.storageFull}</span>}
            {thinkingMs != null && (
              <span className="meta-time">{t.thoughtFor.replace("{time}", formatDuration(thinkingMs))}</span>
            )}
          </div>
        )}
        <div className="message-bubble assistant">
          <Markdown content={text} labels={labels} />
        </div>
        {loginRequired && (
          <button className="login-cta" onClick={onLogIn}>
            {t.logIn}
          </button>
        )}
        {showCopy && (
          <div className="msg-actions">
            <button className="copy-btn" onClick={handleCopy} title={t.copy}>
              {copied ? "✓" : "⧉"}
            </button>
            <button className={`copy-btn ${vote === "up" ? "on" : ""}`} onClick={() => handleVote("up")} title="Like">
              <Icon d={UP} />
            </button>
            <button className={`copy-btn ${vote === "down" ? "on" : ""}`} onClick={() => handleVote("down")} title="Dislike">
              <Icon d={UP} className="thumb-down" />
            </button>
            {showRegenerate && (
              <button className="copy-btn" onClick={onRegenerate} title="Regenerate">
                <Icon d={REFRESH} />
              </button>
            )}
          </div>
        )}
        {showCopy && vote === "down" && (
          <div className="reason-row">
            {REASONS.map((r) => (
              <button key={r} className={`reason-chip ${reason === r ? "on" : ""}`} onClick={() => handleReason(r)}>
                {t[REASON_KEYS[r]]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
