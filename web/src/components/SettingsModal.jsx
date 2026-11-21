import { useEffect, useState } from "react";
import { languageOptions } from "../locales/translations";
import {
  fetchMemories,
  deleteMemory,
  clearMemories,
  exportMemories,
  fetchStorage,
  fetchChats,
  deleteChatRemote,
} from "../api/chatApi";
import { formatBytes } from "../utils";
import LegalViewer from "./LegalViewer";

function SelectRow({ label, desc, value, options, onChange }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label-main">{label}</div>
        {desc && <div className="settings-label-desc">{desc}</div>}
      </div>
      <select className="settings-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
}

const TABS = ["general", "account", "personalization", "memory", "data", "legal"];

export default function SettingsModal({
  user,
  setUser,
  lang,
  setLang,
  t,
  onClose,
  onLogOut,
  onDeleteAllChats,
  settings,
  settingsError,
  onSaveSettings,
  onRestoreChat,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [nickname, setNickname] = useState(settings?.nickname || user?.nickname || "");
  const [instructions, setInstructions] = useState(settings?.instructions || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [memories, setMemories] = useState(null);
  const [storage, setStorage] = useState(null);
  const [archived, setArchived] = useState(null);

  const tabLabels = {
    general: t.general,
    account: t.account,
    personalization: t.personalization,
    memory: t.memory,
    data: t.dataControls,
    legal: t.legal,
  };

  useEffect(() => {
    if (activeTab === "memory") {
      fetchMemories().then(setMemories).catch((err) => console.error(err));
    }
    if (activeTab === "data") {
      fetchStorage().then(setStorage).catch((err) => console.error(err));
      fetchChats(true).then(setArchived).catch((err) => console.error(err));
    }
  }, [activeTab]);

  function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUser({ ...user, avatarUrl: URL.createObjectURL(file) });
  }

  async function handleDeleteMemory(id) {
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleClearMemories() {
    await clearMemories();
    setMemories([]);
    setConfirmingClear(false);
  }

  async function handleExport() {
    const text = await exportMemories();
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "flare-memory.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestore(id) {
    await onRestoreChat(id);
    setArchived((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleDeleteArchived(id) {
    await deleteChatRemote(id);
    setArchived((prev) => prev.filter((c) => c.id !== id));
  }

  const percent = storage ? Math.min(100, (storage.used / storage.quota) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sidebar">
          <div className="settings-title">{t.settings}</div>
          {TABS.map((tab) => (
            <div
              key={tab}
              className={`settings-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </div>
          ))}
        </div>

        <div className="settings-panel">
          <button className="modal-close" onClick={onClose}>✕</button>

          {activeTab === "general" && (
            <>
              <div className="settings-row">
                <div className="settings-label-main">{t.language}</div>
                <select className="settings-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                  {languageOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="settings-row">
                <div className="settings-label-main">{t.appVersion}</div>
                <span className="settings-value-muted">v0.2.0</span>
              </div>
            </>
          )}

          {activeTab === "account" && (
            <>
              <div className="settings-row">
                <div>
                  <div className="settings-label-main">{t.avatar}</div>
                  <div className="settings-label-desc">{t.avatarDesc}</div>
                </div>
                <div className="avatar-upload-group">
                  <div className="avatar avatar-lg">
                    {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : (user?.nickname?.[0] || "U")}
                  </div>
                  <label className="btn-secondary avatar-upload-btn">
                    {t.changeAvatar}
                    <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                  </label>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label-main">{t.nickname}</div>
                  <div className="settings-label-desc">{t.nicknameDesc}</div>
                </div>
                <input
                  className="settings-input"
                  value={nickname}
                  maxLength={40}
                  onChange={(e) => setNickname(e.target.value)}
                  onBlur={() => nickname.trim() !== (settings?.nickname || "") && onSaveSettings({ nickname: nickname.trim() })}
                />
              </div>
              <div className="settings-row">
                <button className="btn-secondary" onClick={onLogOut}>{t.logOut}</button>
              </div>
            </>
          )}

          {(activeTab === "personalization" || activeTab === "memory") && !settings && (
            <div className="settings-block">
              <div className="settings-label-main">
                {settingsError === "login"
                  ? "Bu bölmə üçün Google ilə daxil olmaq lazımdır."
                  : "Ayarlar yüklənmədi: " + settingsError}
              </div>
              <div className="settings-label-desc">Backend işləyir və VITE_API_BASE_URL düzgündür?</div>
            </div>
          )}

          {activeTab === "personalization" && settings && (
            <>
              <SelectRow
                label={t.character}
                desc={t.characterDesc}
                value={settings.character}
                options={t.characterOptions}
                onChange={(value) => onSaveSettings({ character: value })}
              />
              <SelectRow
                label={t.emojiUse}
                value={settings.emoji}
                options={t.emojiOptions}
                onChange={(value) => onSaveSettings({ emoji: value })}
              />
              <SelectRow
                label={t.markdownUse}
                value={settings.markdown}
                options={t.markdownOptions}
                onChange={(value) => onSaveSettings({ markdown: value })}
              />
              <div className="settings-block">
                <div className="settings-label-main">{t.customInstructions}</div>
                <div className="settings-label-desc">{t.customInstructionsDesc}</div>
                <textarea
                  className="settings-textarea"
                  rows={5}
                  maxLength={600}
                  placeholder={t.customInstructionsPlaceholder}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  onBlur={() => instructions.trim() !== settings.instructions && onSaveSettings({ instructions: instructions.trim() })}
                />
              </div>
            </>
          )}

          {activeTab === "memory" && settings && (
            <>
              <div className="settings-row">
                <div>
                  <div className="settings-label-main">{t.memoryToggle}</div>
                  <div className="settings-label-desc">{t.memoryToggleDesc}</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.memory_enabled}
                    onChange={(e) => onSaveSettings({ memory_enabled: e.target.checked })}
                  />
                  <span className="switch-track" />
                </label>
              </div>
              <div className="settings-block">
                {memories === null ? null : memories.length === 0 ? (
                  <div className="settings-label-desc">{t.memoryEmpty}</div>
                ) : (
                  <div className="settings-list">
                    {memories.map((m) => (
                      <div key={m.id} className="settings-list-item">
                        <span>{m.content}</span>
                        <button className="icon-btn" onClick={() => handleDeleteMemory(m.id)} title={t.delete}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {memories && memories.length > 0 && (
                <div className="settings-row no-border">
                  <button className="btn-secondary" onClick={handleExport}>{t.memoryExport}</button>
                  {confirmingClear ? (
                    <div className="confirm-actions">
                      <button className="btn-secondary" onClick={() => setConfirmingClear(false)}>{t.cancel}</button>
                      <button className="btn-danger" onClick={handleClearMemories}>{t.confirm}</button>
                    </div>
                  ) : (
                    <button className="danger-btn" onClick={() => setConfirmingClear(true)}>{t.memoryClear}</button>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "legal" && <LegalViewer t={t} defaultLang={lang === "en" ? "en" : "az"} />}

          {activeTab === "data" && (
            <>
              <div className="settings-block">
                <div className="settings-label-main">{t.storage}</div>
                <div className="settings-label-desc">{t.storageDesc}</div>
                {storage && (
                  <>
                    <div className="storage-bar"><div style={{ width: `${percent}%` }} /></div>
                    <div className="settings-label-desc">
                      {formatBytes(storage.used)} / {formatBytes(storage.quota)}
                    </div>
                  </>
                )}
              </div>
              <div className="settings-block">
                <div className="settings-label-main">{t.archivedChats}</div>
                {archived && archived.length === 0 && <div className="settings-label-desc">{t.archivedEmpty}</div>}
                <div className="settings-list">
                  {(archived || []).map((chat) => (
                    <div key={chat.id} className="settings-list-item">
                      <span>{chat.title}</span>
                      <span className="item-actions">
                        <button className="btn-secondary small" onClick={() => handleRestore(chat.id)}>{t.restore}</button>
                        <button className="icon-btn" onClick={() => handleDeleteArchived(chat.id)} title={t.delete}>✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label-main">{t.deleteAllChats}</div>
                  <div className="settings-label-desc">
                    {confirmingDelete ? t.deleteConfirm : t.deleteAllChatsDesc}
                  </div>
                </div>
                {confirmingDelete ? (
                  <div className="confirm-actions">
                    <button className="btn-secondary" onClick={() => setConfirmingDelete(false)}>{t.cancel}</button>
                    <button
                      className="btn-danger"
                      onClick={() => {
                        onDeleteAllChats();
                        setConfirmingDelete(false);
                        setArchived([]);
                      }}
                    >
                      {t.confirm}
                    </button>
                  </div>
                ) : (
                  <button className="danger-btn" onClick={() => setConfirmingDelete(true)}>{t.deleteAllChats}</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
