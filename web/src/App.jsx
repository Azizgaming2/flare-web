import { useState, useEffect, useMemo, useRef } from "react";
import SplashScreen from "./components/SplashScreen";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Home from "./components/Home";
import MessageInput from "./components/MessageInput";
import SettingsModal from "./components/SettingsModal";
import UpdatesPage from "./components/UpdatesPage";
import AgeGate from "./components/AgeGate";
import AuthModal from "./components/AuthModal";
import { Capacitor } from "@capacitor/core";
import "./updates.css";
import "./redesign2.css";
import "./redesign3.css";
import "./mobile.css";
import { translations } from "./locales/translations";
import { useAuth } from "./hooks/UseAuth";
import { loginWithGoogle, logout } from "./firebase";
import {
  streamChatMessage,
  generateChatTitle,
  fetchChats,
  fetchChatMessages,
  archiveChat,
  deleteChatRemote,
  deleteAllChatsRemote,
  fetchSettings,
  saveSettings,
  fetchModels,
  fetchAccountStatus,
  confirmAge,
  sendFeedback,
} from "./api/chatApi";

function errorMessage(err, t) {
  const detail = err?.detail;
  if (err?.status === 429 && detail?.code === "login_required") {
    return { content: t.loginRequired, error: true, loginRequired: true };
  }
  if (err?.status === 429 && detail?.code === "limit_reached") {
    const minutes = Math.max(1, Math.ceil((detail.retry_after || 60) / 60));
    const time = minutes >= 60 ? `${Math.ceil(minutes / 60)} ${t.hours}` : `${minutes} ${t.minutes}`;
    return { content: t.limitReached.replace("{time}", time), error: true };
  }
  if (err?.status === 403 && detail?.code === "suspended") {
    return { content: t.suspendedText, error: true };
  }
  if (err?.status === 403 && detail?.code === "age_required") {
    return { content: t.ageText, error: true };
  }
  return { content: t.requestError, error: true };
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [lang, setLang] = useState("en");
  const [showLogin, setShowLogin] = useState(false);
  const [mode, setMode] = useState("fast");
  const [showSettings, setShowSettings] = useState(false);
  const [page, setPage] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loadingChats, setLoadingChats] = useState({});
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState("");
  const [model, setModel] = useState("tentium");
  const [models, setModels] = useState([]);
  const [webSearch, setWebSearch] = useState(false);
  const [account, setAccount] = useState(null);

  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const abortRef = useRef({});

  const { user, setUser } = useAuth();
  const uid = user?.uid;

  const t = translations[lang];

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetchModels()
      .then((list) => {
        setModels(list);
        setModel((current) =>
          list.some((m) => m.id === current && m.available)
            ? current
            : list.find((m) => m.available)?.id || current
        );
      })
      .catch((err) => console.error("Loading models failed:", err));
  }, []);

  async function loadRemoteChats() {
    const list = await fetchChats();
    setChats((prev) => {
      const known = new Set(prev.map((c) => c.id));
      const remote = list
        .filter((c) => !known.has(c.id))
        .map((c) => ({ id: c.id, title: c.title, messages: [], loaded: false }));
      return [...prev, ...remote];
    });
  }

  useEffect(() => {
    if (!uid) {
      setSettings(null);
      setAccount(null);
      setSettingsError("login");
      return undefined;
    }
    let cancelled = false;

    loadRemoteChats().catch((err) => console.error("Loading chats failed:", err));
    fetchAccountStatus()
      .then((status) => {
        if (!cancelled) setAccount(status);
      })
      .catch((err) => console.error("Loading account status failed:", err));

    fetchSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        setSettingsError("");
        setUser((current) => (current ? { ...current, nickname: loaded.nickname } : current));
      })
      .catch((err) => {
        console.error("Loading settings failed:", err);
        if (!cancelled) setSettingsError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const messages = activeChat?.messages || [];
  const activeTitle = activeChatId === null || page !== null ? "" : activeChat?.title || "";

  useEffect(() => {
    function applyTitle() {
      document.title = document.hidden || !activeTitle ? "Flare AI" : activeTitle;
    }
    applyTitle();
    document.addEventListener("visibilitychange", applyTitle);
    return () => document.removeEventListener("visibilitychange", applyTitle);
  }, [activeTitle]);
  const isHistoryLoading = !!activeChat && !activeChat.loaded;
  const isActiveLoading = activeChatId !== null && !!loadingChats[activeChatId];

  const greeting = useMemo(() => {
    const raw = t.greetings[Math.floor(Math.random() * t.greetings.length)];
    const name = user?.nickname || user?.name;
    return name ? raw.replace("{name}", name) : raw.replace(/,?\s*\{name\}/, "");
  }, [t, user, activeChatId]);

  function patchMessage(chatId, index, patch) {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId || !chat.messages[index]) return chat;
        const updated = [...chat.messages];
        updated[index] = { ...updated[index], ...patch };
        return { ...chat, messages: updated };
      })
    );
  }

  function finishLoading(chatId) {
    setLoadingChats((prev) => {
      if (!prev[chatId]) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }

  function handleNewChat() {
    setActiveChatId(null);
  }

  async function handleSelectChat(chatId) {
    setActiveChatId(chatId);
    const chat = chatsRef.current.find((c) => c.id === chatId);
    if (!chat || chat.loaded) return;

    let loadedMessages = [];
    try {
      loadedMessages = await fetchChatMessages(chatId);
    } catch (err) {
      console.error("Loading chat failed:", err);
    }
    setChats((prev) =>
      prev.map((c) => (c.id === chatId && !c.loaded ? { ...c, messages: loadedMessages, loaded: true } : c))
    );
  }

  function handleRegenerate() {
    const list = chatsRef.current.find((c) => c.id === activeChatId)?.messages || [];
    const lastUser = [...list].reverse().find((m) => m.role === "user");
    if (lastUser) handleSend(lastUser.content, true, lastUser.attachments || []);
  }

  async function handleSend(text, replaceLast = false, files = []) {
    const content = text.trim();
    if (!content) return;

    const isNewChat = activeChatId === null;
    const chatId = isNewChat ? Date.now().toString() : activeChatId;
    if (loadingChats[chatId]) return;

    const existing = chatsRef.current.find((c) => c.id === chatId);
    if (existing && !existing.loaded) return;

    const previous = (replaceLast === true ? existing?.messages.slice(0, -2) : existing?.messages) || [];
    const history = previous
      .filter((m) => !m.error && m.content.trim())
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.attachments?.length ? { attachments: m.attachments } : {}),
      }));
    const requestMessages = [...history, { role: "user", content, ...(files.length ? { attachments: files } : {}) }];
    const isFirstExchange = history.length === 0;
    const assistantIndex = previous.length + 1;

    setChats((prev) => {
      const base = isNewChat
        ? [{ id: chatId, title: content.slice(0, 30), messages: [], loaded: true }, ...prev]
        : prev;
      return base.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [
                ...(replaceLast === true ? c.messages.slice(0, -2) : c.messages),
                { role: "user", content, ...(files.length ? { attachments: files } : {}) },
                { role: "assistant", content: "", startedAt: Date.now() },
              ],
            }
          : c
      );
    });
    if (isNewChat) setActiveChatId(chatId);
    setLoadingChats((prev) => ({ ...prev, [chatId]: true }));

    const controller = new AbortController();
    abortRef.current[chatId] = controller;
    let succeeded = false;

    try {
      await streamChatMessage(requestMessages, mode, chatId, model, {
        signal: controller.signal,
        search: webSearch,
        onToken: (token) => {
          setChats((prev) =>
            prev.map((chat) => {
              if (chat.id !== chatId || !chat.messages[assistantIndex]) return chat;
              const updated = [...chat.messages];
              updated[assistantIndex] = {
                ...updated[assistantIndex],
                content: updated[assistantIndex].content + token,
              };
              return { ...chat, messages: updated };
            })
          );
        },
        onDone: (data) => {
          if (data.thinking_ms != null) patchMessage(chatId, assistantIndex, { thinkingMs: data.thinking_ms });
          finishLoading(chatId);
        },
        onTrim: (remove) =>
          setChats((prev) =>
            prev.map((chat) => {
              if (chat.id !== chatId || !chat.messages[assistantIndex]) return chat;
              const updated = [...chat.messages];
              const chars = Array.from(updated[assistantIndex].content);
              updated[assistantIndex] = {
                ...updated[assistantIndex],
                content: chars.slice(0, Math.max(0, chars.length - remove)).join(""),
              };
              return { ...chat, messages: updated };
            })
          ),
        onMemory: () => patchMessage(chatId, assistantIndex, { memoryUpdated: true }),
        onStorageFull: () => patchMessage(chatId, assistantIndex, { storageFull: true }),
      });
      succeeded = true;
    } catch (err) {
      if (err?.name === "AbortError") {
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== chatId) return chat;
            const last = chat.messages[chat.messages.length - 1];
            return last && last.role === "assistant" && !last.content
              ? { ...chat, messages: chat.messages.slice(0, -1) }
              : chat;
          })
        );
      } else {
        console.error("Chat request failed:", err);
        if (err?.status === 403 && err?.detail?.code === "suspended") {
          setAccount({ age_confirmed: true, suspended: true });
        }
        if (err?.status === 403 && err?.detail?.code === "age_required") {
          setAccount({ age_confirmed: false, suspended: false });
        }
        setChats((prev) =>
          prev.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [
                    ...chat.messages.slice(0, assistantIndex),
                    { role: "assistant", ...errorMessage(err, t) },
                  ],
                }
              : chat
          )
        );
      }
    } finally {
      delete abortRef.current[chatId];
      finishLoading(chatId);
    }

    if (succeeded && isFirstExchange) {
      generateChatTitle(content, chatId).then((title) => {
        if (!title) return;
        setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
      });
    }
  }

  function handleFeedback(index, rating, reason) {
    if (!uid || activeChatId === null) return;
    const chat = chatsRef.current.find((c) => c.id === activeChatId);
    const answer = chat?.messages[index];
    const question = [...(chat?.messages.slice(0, index) || [])].reverse().find((m) => m.role === "user");
    if (!answer || !question) return;
    sendFeedback({
      chat_id: activeChatId,
      message_index: index,
      rating,
      reason: reason || null,
      prompt: question.content.slice(0, 8000),
      response: answer.content.slice(0, 20000),
      mode,
    }).catch((err) => console.error("Feedback failed:", err));
  }

  function handleStop() {
    abortRef.current[activeChatId]?.abort();
  }

  function abortAll() {
    Object.values(abortRef.current).forEach((controller) => controller.abort());
  }

  function removeChatLocally(chatId) {
    abortRef.current[chatId]?.abort();
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    setActiveChatId((current) => (current === chatId ? null : current));
  }

  async function handleArchiveChat(chatId) {
    try {
      await archiveChat(chatId, true);
      removeChatLocally(chatId);
    } catch (err) {
      console.error("Archiving chat failed:", err);
    }
  }

  function handleDeleteChat(chatId) {
    removeChatLocally(chatId);
    if (uid) deleteChatRemote(chatId).catch((err) => console.error("Deleting chat failed:", err));
  }

  async function handleRestoreChat(chatId) {
    await archiveChat(chatId, false);
    await loadRemoteChats();
  }

  function handleDeleteAllChats() {
    abortAll();
    setChats([]);
    setActiveChatId(null);
    if (uid) deleteAllChatsRemote().catch((err) => console.error("Deleting chats failed:", err));
  }

  async function handleSaveSettings(patch) {
    try {
      const saved = await saveSettings(patch);
      setSettings(saved);
      if ("nickname" in patch) {
        setUser((current) => (current ? { ...current, nickname: saved.nickname } : current));
      }
    } catch (err) {
      console.error("Saving settings failed:", err);
    }
  }

  async function handleConfirmAge() {
    try {
      setAccount(await confirmAge());
    } catch (err) {
      console.error("Age confirmation failed:", err);
    }
  }

  async function handleLogIn() {
    if (Capacitor.isNativePlatform()) {
      setShowLogin(true);
      return;
    }
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Login failed:", err);
    }
  }

  async function handleLogOut() {
    abortAll();
    await logout();
    setChats([]);
    setActiveChatId(null);
    setSettings(null);
    setShowSettings(false);
  }

  if (showSplash) return <SplashScreen />;

  return (
    <div className={`app-layout ${drawerOpen ? "drawer-open" : ""}`}>
      <button className="mobile-menu-btn" onClick={() => setDrawerOpen(true)} aria-label="Menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      {showLogin && (
        <AuthModal lang={lang} onClose={() => setShowLogin(false)} onDone={() => setShowLogin(false)} />
      )}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          setPage(null);
          setDrawerOpen(false);
          handleSelectChat(id);
        }}
        onNewChat={() => {
          setPage(null);
          setDrawerOpen(false);
          handleNewChat();
        }}
        onOpenUpdates={() => { setPage("updates"); setDrawerOpen(false); }}
        onArchiveChat={handleArchiveChat}
        onDeleteChat={handleDeleteChat}
        t={t}
        user={user}
        onOpenSettings={() => { setShowSettings(true); setDrawerOpen(false); }}
        onLogIn={handleLogIn}
        onLogOut={handleLogOut}
        lang={lang}
        setLang={setLang}
        languages={Object.keys(translations)}
      />

      <div className={`chat-main ${activeChatId === null && page === null ? "is-home" : ""}`}>
        {page === "updates" ? (
          <UpdatesPage uid={uid} t={t} />
        ) : activeChatId === null ? (
          <Home greeting={greeting} t={t} onPick={handleSend} />
        ) : (
          <ChatWindow
            messages={messages}
            isLoading={isActiveLoading}
            isHistoryLoading={isHistoryLoading}
            lang={lang}
            emptyText={greeting}
            userAvatarUrl={user?.avatarUrl}
            onRegenerate={handleRegenerate}
            onLogIn={handleLogIn}
            onFeedback={handleFeedback}
            t={t}
          />
        )}
        {page === null && (
        <MessageInput
          onSend={handleSend}
          onStop={handleStop}
          isGenerating={isActiveLoading}
          mode={mode}
          setMode={setMode}
          model={model}
          setModel={setModel}
          models={models}
          webSearch={webSearch}
          setWebSearch={setWebSearch}
          lang={lang}
          loggedIn={!!uid}
          t={t}
        />
        )}
      </div>

      {showSettings && (
        <SettingsModal
          user={user}
          setUser={setUser}
          lang={lang}
          setLang={setLang}
          t={t}
          settings={settings}
          settingsError={settingsError}
          onSaveSettings={handleSaveSettings}
          onRestoreChat={handleRestoreChat}
          onClose={() => setShowSettings(false)}
          onLogOut={handleLogOut}
          onDeleteAllChats={handleDeleteAllChats}
        />
      )}

      {uid && account && (account.suspended || !account.age_confirmed) && (
        <AgeGate account={account} t={t} onConfirm={handleConfirmAge} onLogOut={handleLogOut} />
      )}
    </div>
  );
}