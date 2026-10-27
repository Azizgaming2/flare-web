import { useState, useEffect } from "react";
import Markdown from "./Markdown";
import { fetchUpdates, createUpdate, deleteUpdate, uploadUpdateMedia, updateMediaUrl, fetchSuspended, unsuspendUser, fetchFeedbackStats, downloadFeedbackExport, fetchAgeReviews, resolveAgeReview, fetchAppeals, resolveAppeal } from "../api/chatApi";

const LABELS = { copy: "Copy", copied: "Copied" };

export default function AdminPanel({ onClose, onChanged }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState([]);
  const [existing, setExisting] = useState([]);
  const [suspended, setSuspended] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [appealList, setAppealList] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({ up: 0, down: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    fetchUpdates()
      .then(setExisting)
      .catch(() => {});
    fetchAgeReviews()
      .then(setReviews)
      .catch(() => {});
    fetchAppeals()
      .then(setAppealList)
      .catch(() => {});
    fetchSuspended()
      .then(setSuspended)
      .catch(() => {});
    fetchFeedbackStats()
      .then(setFeedbackStats)
      .catch(() => {});
  }

  async function handleReview(id, action) {
    const text = action === "freeze" ? "Hesab dondurulsun?" : "Şübhə rədd edilsin?";
    if (!window.confirm(text)) return;
    try {
      await resolveAgeReview(id, action);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAppeal(id, action) {
    const text = action === "approve" ? "Müraciət təsdiqlənsin və e-poçt whitelist-ə əlavə olunsun?" : "Müraciət rədd edilsin?";
    if (!window.confirm(text)) return;
    try {
      await resolveAppeal(id, action);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnsuspend(uid) {
    if (!window.confirm("Bu hesab təsdiqlənsin?")) return;
    try {
      await unsuspendUser(uid);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        const name = await uploadUpdateMedia(file);
        setMedia((prev) => [...prev, name].slice(0, 6));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!title.trim()) {
      setError("Başlıq lazımdır");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createUpdate({ title: title.trim(), body, media });
      setTitle("");
      setBody("");
      setMedia([]);
      refresh();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Bu yenilik silinsin?")) return;
    try {
      await deleteUpdate(id);
      refresh();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-box">
        <div className="admin-head">
          <h3>Yeniliklər paneli</h3>
          <button className="admin-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-body">
          <label className="admin-label">Başlıq</label>
          <input className="admin-input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />

          <label className="admin-label">Mətn (Markdown)</label>
          <textarea className="admin-textarea" value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />

          {body.trim() && (
            <div className="admin-preview">
              <Markdown content={body} labels={LABELS} />
            </div>
          )}

          <label className="admin-label">Şəkil və video (JPG, PNG, GIF, WEBP, MP4, WEBM; maks. 6)</label>
          <input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" onChange={handleFiles} disabled={busy || media.length >= 6} />

          {media.length > 0 && (
            <div className="admin-media">
              {media.map((name) => (
                <div key={name} className="admin-media-item">
                  {/\.(mp4|webm)$/.test(name) ? (
                    <video src={updateMediaUrl(name)} muted preload="metadata" />
                  ) : (
                    <img src={updateMediaUrl(name)} alt="" />
                  )}
                  <button onClick={() => setMedia((prev) => prev.filter((n) => n !== name))}>Çıxar</button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="admin-error">{error}</div>}

          <button className="admin-publish" onClick={handlePublish} disabled={busy}>
            {busy ? "Gözləyin" : "Dərc et"}
          </button>

          <label className="admin-label">Dərc olunanlar</label>
          {existing.length === 0 && <div className="admin-empty">Hələ yoxdur</div>}
          {existing.map((u) => (
            <div key={u.id} className="admin-row">
              <span>{u.title}</span>
              <time>{new Date(u.created).toLocaleString()}</time>
              <button onClick={() => handleDelete(u.id)}>Sil</button>
            </div>
          ))}

          <label className="admin-label">Rəylər (RLHF məlumatı)</label>
          <div className="admin-row">
            <span>
              Bəyənmə: {feedbackStats.up} / Bəyənməmə: {feedbackStats.down}
            </span>
            <button onClick={() => downloadFeedbackExport().catch((err) => setError(err.message))}>Export</button>
          </div>

          <label className="admin-label">Yaş şübhəsi (təsdiq növbəsi)</label>
          {reviews.length === 0 && <div className="admin-empty">Yoxdur</div>}
          {reviews.map((r) => (
            <div key={r.id} className="admin-case">
              <div className="admin-case-head">
                <span>{r.email || r.uid}</span>
                <time>{new Date(r.created_at * 1000).toLocaleString()}</time>
              </div>
              <div className="admin-case-reason">{r.reason || "-"}</div>
              <ol className="admin-case-msgs">
                {r.messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
              <div className="admin-case-actions">
                <button onClick={() => handleReview(r.id, "freeze")}>Dondur</button>
                <button onClick={() => handleReview(r.id, "dismiss")}>Rədd et</button>
              </div>
            </div>
          ))}

          <label className="admin-label">Məktəb müraciətləri</label>
          {appealList.length === 0 && <div className="admin-empty">Yoxdur</div>}
          {appealList.map((a) => (
            <div key={a.id} className="admin-case">
              <div className="admin-case-head">
                <span>
                  {a.first_name} {a.last_name} ({a.class_name})
                </span>
                <time>{new Date(a.created_at * 1000).toLocaleString()}</time>
              </div>
              <div className="admin-case-reason">{a.email}</div>
              <div className="admin-case-actions">
                <button onClick={() => handleAppeal(a.id, "approve")}>Təsdiqlə</button>
                <button onClick={() => handleAppeal(a.id, "reject")}>Rədd et</button>
              </div>
            </div>
          ))}

          <label className="admin-label">Dayandırılmış hesablar</label>
          {suspended.length === 0 && <div className="admin-empty">Yoxdur</div>}
          {suspended.map((u) => (
            <div key={u.uid} className="admin-row">
              <span>{u.email || u.uid}</span>
              <time>{new Date(u.suspended_at * 1000).toLocaleString()}</time>
              <button onClick={() => handleUnsuspend(u.uid)}>Təsdiqlə</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}