import { useState } from "react";
import { useClassRoom } from "../../hooks/useClassRoom";
import VideoTile from "./VideoTile";
import ClassChat from "./ClassChat";
import ClassTools from "./ClassTools";

export default function ClassRoom({ code, userName, lang, s, onLeave }) {
  const room = useClassRoom(code, userName);
  const [tab, setTab] = useState("stage");
  const [copied, setCopied] = useState(false);

  const { me, peers, streams } = room;
  const isHost = me?.role === "host";
  const list = Object.values(peers);
  const students = list.filter((p) => p.role !== "host");
  const hostPeer = list.find((p) => p.role === "host");
  const locked = !!(me && peers[me.pid]?.muted);
  const toast = room.notice ? s.notes[room.notice] || s.errors[room.notice] || "" : "";

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function endClass() {
    room.endClass();
    onLeave();
  }

  if (room.ended) {
    return (
      <div className="cl-center">
        <p>{s.ended[room.ended] || s.ended.lost}</p>
        <button type="button" className="cl-btn pri" onClick={onLeave}>{s.back}</button>
      </div>
    );
  }

  if (!me) return <div className="cl-center"><p>{s.connecting}</p></div>;

  return (
    <div className={`cl-room tab-${tab}${isHost ? " has-tools" : ""}`}>
      <header className="cl-head">
        <div className="cl-head-main">
          <strong>{room.title}</strong>
          <button type="button" className="cl-code" onClick={copyCode} title={s.copy}>
            {copied ? s.copied : `${s.classCode}: ${code}`}
          </button>
          <span className="cl-count">{list.length} {s.people}</span>
        </div>
        <nav className="cl-tabs">
          <button type="button" className={tab === "stage" ? "on" : ""} onClick={() => setTab("stage")}>{s.tabStage}</button>
          {isHost && <button type="button" className={tab === "tools" ? "on" : ""} onClick={() => setTab("tools")}>{s.tabTools}</button>}
          <button type="button" className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>{s.tabChat}</button>
        </nav>
        <div className="cl-head-actions">
          <button type="button" className="cl-btn" onClick={onLeave}>{s.leave}</button>
          {isHost && <button type="button" className="cl-btn bad" onClick={endClass}>{s.endClass}</button>}
        </div>
      </header>

      {isHost && (
        <aside className="cl-tools">
          <ClassTools code={code} peers={peers} s={s} onMute={room.mute} onKick={room.kick} onSend={room.sendChat} />
        </aside>
      )}

      <main className="cl-stage">
        {isHost ? (
          <div className="cl-grid">
            <VideoTile big muted stream={room.localStream} name={s.you} off={!room.localStream} />
            {students.map((p) => (
              <VideoTile key={p.pid} stream={streams[p.pid]} name={p.name} flag={p.muted ? s.muted : ""} off={!p.cam} />
            ))}
          </div>
        ) : (
          <div className="cl-main">
            {hostPeer ? (
              <VideoTile big stream={streams[hostPeer.pid]} name={hostPeer.name} off={!hostPeer.cam && !room.screenOn} />
            ) : (
              <div className="cl-center"><p>{s.waitHost}</p></div>
            )}
            {room.localStream && (
              <div className="cl-self">
                <VideoTile muted stream={room.localStream} name={s.you} />
              </div>
            )}
          </div>
        )}

        {room.sharing && <div className="cl-banner">{s.sharingNow}</div>}
        {toast && <div className="cl-toast">{toast}</div>}

        <div className="cl-bar">
          <button type="button" className={`cl-btn${room.mic ? " on" : ""}`} onClick={room.toggleMic} disabled={locked}>
            {locked ? s.micLocked : s.mic}
          </button>
          <button type="button" className={`cl-btn${room.cam ? " on" : ""}`} onClick={room.toggleCam}>
            {s.cam}
          </button>
          {isHost && room.canShare && (
            <button type="button" className={`cl-btn${room.sharing ? " on" : ""}`} onClick={room.toggleScreen}>
              {room.sharing ? s.stopScreen : s.screen}
            </button>
          )}
        </div>
      </main>

      <aside className="cl-chat">
        <ClassChat
          code={code}
          msgs={room.msgs}
          isHost={isHost}
          lang={lang}
          s={s}
          onSend={room.sendChat}
          onNotice={room.flash}
        />
      </aside>
    </div>
  );
}
