import { useState, useEffect, useCallback } from "react";
import Markdown from "./Markdown";
import AdminPanel from "./AdminPanel";
import { fetchUpdates, fetchIsAdmin, updateMediaUrl } from "../api/chatApi";
import { writeSeen } from "../updatesSeen";

export default function UpdatesPage({ uid, t }) {
  const [updates, setUpdates] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const labels = { copy: t.copy || "Copy", copied: t.copied || "Copied" };

  const load = useCallback(() => {
    fetchUpdates()
      .then((list) => {
        setUpdates(list);
        if (list[0]) {
          writeSeen(list[0].created);
          window.dispatchEvent(new Event("flare-seen"));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!uid) {
      setIsAdmin(false);
      return;
    }
    fetchIsAdmin()
      .then(setIsAdmin)
      .catch(() => setIsAdmin(false));
  }, [uid]);

  return (
    <div className="updates-page">
      <div className="updates-inner">
        <div className="updates-head">
          <h1>{t.updatesTitle || "Updates"}</h1>
          {isAdmin && (
            <button className="notif-manage" onClick={() => setShowAdmin(true)}>
              Idarə et
            </button>
          )}
        </div>
        {updates.length === 0 && <div className="notif-empty">{t.noUpdates || "No updates yet"}</div>}
        {updates.map((u) => (
          <article key={u.id} className="notif-item">
            <h4>{u.title}</h4>
            <time>{new Date(u.created).toLocaleString()}</time>
            {u.body && <Markdown content={u.body} labels={labels} />}
            {(u.media || []).map((name) =>
              /\.(mp4|webm)$/.test(name) ? (
                <video key={name} src={updateMediaUrl(name)} controls preload="metadata" />
              ) : (
                <img key={name} src={updateMediaUrl(name)} alt="" loading="lazy" />
              )
            )}
          </article>
        ))}
      </div>
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} onChanged={load} />}
    </div>
  );
}
