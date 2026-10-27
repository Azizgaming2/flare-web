import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";

const LANG_NAMES = { az: "Azərbaycanca", en: "English", tr: "Türkçe" };
const USAGE_KEY = "flare_usage";
const EMPTY_USAGE = { total: 0, days: {} };

function readUsage() {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY)) || EMPTY_USAGE;
  } catch {
    return EMPTY_USAGE;
  }
}

function addUsage(seconds) {
  const usage = readUsage();
  const day = new Date().toISOString().slice(0, 10);
  usage.total += seconds;
  usage.days[day] = (usage.days[day] || 0) + seconds;
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  } catch {
    return;
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onArchiveChat,
  onDeleteChat,
  t,
  user,
  onOpenSettings,
  onLogIn,
  onLogOut,
  onOpenUpdates,
  lang,
  setLang,
  languages,
}) {
  const [menu, setMenu] = useState(null);
  const [userMenu, setUserMenu] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState(readUsage);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") addUsage(15);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!menu && !userMenu && !searchOpen) return undefined;
    const close = () => {
      setMenu(null);
      setSearchOpen(false);
      setUserMenu(false);
      setLangOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
    };
  }, [menu, userMenu, searchOpen]);

  function openMenu(e, chatId) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ chatId, x: rect.right - 160, y: rect.bottom + 4 });
  }

  const q = query.trim().toLowerCase();
  const results = q
    ? chats
        .filter((c) => (c.title || "").toLowerCase().includes(q) || (c.messages || []).some((m) => (m.content || "").toLowerCase().includes(q)))
        .slice(0, 6)
    : [];
  const today = usage.days[new Date().toISOString().slice(0, 10)] || 0;

  function toggleSearch() {
    setUsage(readUsage());
    setUserMenu(false);
    setSearchOpen(!searchOpen);
  }

  return (
    <div className="sidebar">
      <div className="sb-brand">Flare AI</div>

      <button className="sb-new" onClick={onNewChat}>
        <span className="sb-plus">+</span>
        {t.newChat}
      </button>

      <div className="chat-history">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`chat-history-item ${chat.id === activeChatId ? "active" : ""}`}
            onClick={() => onSelectChat(chat.id)}
          >
            <span className="chat-item-title">{chat.title}</span>
            <button className="chat-menu-btn" onClick={(e) => openMenu(e, chat.id)}>⋯</button>
          </div>
        ))}
      </div>

      {menu && (
        <div className="chat-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          {user && (
            <button
              className="chat-menu-item"
              onClick={() => {
                onArchiveChat(menu.chatId);
                setMenu(null);
              }}
            >
              {t.archive}
            </button>
          )}
          <button
            className="chat-menu-item danger"
            onClick={() => {
              onDeleteChat(menu.chatId);
              setMenu(null);
            }}
          >
            {t.delete}
          </button>
        </div>
      )}

      <div className="sb-footer" onClick={(e) => e.stopPropagation()}>
        {user ? (
          <>
            {userMenu && (
              <div className="sb-dropdown">
                <button
                  className="sb-drop-item"
                  onClick={() => {
                    setUserMenu(false);
                    onOpenSettings();
                  }}
                >
                  {t.settings}
                </button>
                <button className="sb-drop-item" onClick={() => setLangOpen(!langOpen)}>
                  {t.language}
                  <span className="sb-drop-value">{LANG_NAMES[lang] || lang}</span>
                </button>
                {langOpen &&
                  languages.map((code) => (
                    <button
                      key={code}
                      className={`sb-drop-item sub ${code === lang ? "current" : ""}`}
                      onClick={() => {
                        setLang(code);
                        setLangOpen(false);
                        setUserMenu(false);
                      }}
                    >
                      {LANG_NAMES[code] || code}
                    </button>
                  ))}
                <div className="sb-drop-sep" />
                <button
                  className="sb-drop-item"
                  onClick={() => {
                    setUserMenu(false);
                    onLogOut();
                  }}
                >
                  {t.logOut}
                </button>
              </div>
            )}
            {searchOpen && (
              <div className="sb-search-pop">
                <input
                  className="sb-search-input"
                  autoFocus
                  value={query}
                  placeholder={t.searchChats || "Search chats"}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {results.map((c) => (
                  <button
                    key={c.id}
                    className="sb-result"
                    onClick={() => {
                      onSelectChat(c.id);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    {c.title}
                  </button>
                ))}
                <div className="sb-stats">
                  <span>{t.statsChats || "Chats"}: <b>{chats.length}</b></span>
                  <span>{t.statsToday || "Time today"}: <b>{formatTime(today)}</b></span>
                  <span>{t.statsTotal || "Total time"}: <b>{formatTime(usage.total)}</b></span>
                </div>
              </div>
            )}
            <div className="sb-row">
            <button
              className="sb-user"
              onClick={() => {
                setSearchOpen(false);
                setUserMenu(!userMenu);
              }}
            >
              <span className="avatar">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : (user.nickname?.[0] || user.name?.[0] || "U")}
              </span>
              <span className="sb-user-name">{user.nickname || user.name}</span>
            </button>
            <button className="sb-icon" onClick={toggleSearch} title={t.searchChats || "Search chats"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
            <NotificationBell onOpen={onOpenUpdates} t={t} />
            </div>
          </>
        ) : (
          <button className="sb-new" onClick={onLogIn}>
            {t.logIn}
          </button>
        )}
      </div>
    </div>
  );
}
