import TaskIdeas from "./TaskIdeas";

export default function ClassTools({ code, peers, s, onMute, onKick, onSend }) {
  const students = Object.values(peers).filter((p) => p.role !== "host");
  const allMuted = students.length > 0 && students.every((p) => p.muted);

  return (
    <div className="cl-tools-inner">
      <section className="cl-section">
        <div className="cl-section-head">
          <h3>{s.participants}</h3>
          {students.length > 0 && (
            <button type="button" className="cl-btn" onClick={() => onMute("all", !allMuted)}>
              {allMuted ? s.unmuteAll : s.muteAll}
            </button>
          )}
        </div>
        {students.length === 0 && <p className="cl-empty">{s.noStudents}</p>}
        <ul className="cl-people">
          {students.map((p) => (
            <li key={p.pid}>
              <span className="cl-person">
                {p.name}
                {p.muted && <small>{s.muted}</small>}
              </span>
              <span className="cl-person-actions">
                <button type="button" className="cl-btn sm" onClick={() => onMute(p.pid, !p.muted)}>
                  {p.muted ? s.unmute : s.mute}
                </button>
                <button type="button" className="cl-btn sm bad" onClick={() => onKick(p.pid)}>
                  {s.kick}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <TaskIdeas code={code} s={s} onSend={onSend} />
    </div>
  );
}
