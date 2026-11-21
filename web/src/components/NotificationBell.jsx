import { useState, useEffect, useCallback } from "react";
import { fetchUpdates } from "../api/chatApi";
import { readSeen } from "../updatesSeen";

export default function NotificationBell({ onOpen, t }) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    fetchUpdates()
      .then((list) => {
        const seen = readSeen();
        setUnread(list.filter((u) => u.created > seen).length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("flare-seen", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("flare-seen", refresh);
    };
  }, [refresh]);

  return (
    <button className="sb-icon" onClick={onOpen} title={t.updatesTitle || "Updates"}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
    </button>
  );
}