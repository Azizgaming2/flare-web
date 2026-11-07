import { useRef, useState } from "react";
import { generateTaskIdea } from "../../api/classApi";

const KINDS = ["test", "homework", "project", "discussion", "creative"];
const GRADES = Array.from({ length: 11 }, (_, i) => String(i + 1));

export default function TaskIdeas({ code, s, onSend }) {
  const [form, setForm] = useState({ kind: "test", subject: "", grade: "", topic: "", level: "medium", count: 5, extra: "" });
  const [ask, setAsk] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subjectRef = useRef(null);
  const topicRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const hasCount = form.kind === "test" || form.kind === "discussion";

  async function generate() {
    if (!form.subject.trim()) {
      setAsk("subject");
      subjectRef.current?.focus();
      return;
    }
    if (!form.topic.trim()) {
      setAsk("topic");
      topicRef.current?.focus();
      return;
    }
    setAsk("");
    setError("");
    setBusy(true);
    try {
      const data = await generateTaskIdea(code, { ...form, count: Number(form.count) || 5 });
      setResult(data.text);
    } catch (err) {
      setError(s.errors[err.code] || s.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cl-section">
      <h3>{s.ideas}</h3>

      <label className="cl-field">
        <span>{s.kind}</span>
        <select value={form.kind} onChange={set("kind")}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{s.kinds[k]}</option>
          ))}
        </select>
      </label>

      <label className="cl-field">
        <span>{s.subject}</span>
        <input ref={subjectRef} className={ask === "subject" ? "need" : ""} value={form.subject} maxLength={100} onChange={set("subject")} />
        {ask === "subject" && <em className="cl-ask">{s.askSubject}</em>}
      </label>

      <label className="cl-field">
        <span>{s.topic}</span>
        <input ref={topicRef} className={ask === "topic" ? "need" : ""} value={form.topic} maxLength={200} onChange={set("topic")} />
        {ask === "topic" && <em className="cl-ask">{s.askTopic}</em>}
      </label>

      <div className="cl-row">
        <label className="cl-field">
          <span>{s.grade}</span>
          <select value={form.grade} onChange={set("grade")}>
            <option value="">{s.anyGrade}</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="cl-field">
          <span>{s.level}</span>
          <select value={form.level} onChange={set("level")}>
            {Object.keys(s.levels).map((k) => (
              <option key={k} value={k}>{s.levels[k]}</option>
            ))}
          </select>
        </label>
        {hasCount && (
          <label className="cl-field">
            <span>{s.count}</span>
            <input type="number" min="1" max="15" value={form.count} onChange={set("count")} />
          </label>
        )}
      </div>

      <label className="cl-field">
        <span>{s.extra}</span>
        <input value={form.extra} maxLength={300} onChange={set("extra")} />
      </label>

      <button type="button" className="cl-btn pri" onClick={generate} disabled={busy}>
        {busy ? s.generating : result ? s.regenerate : s.generate}
      </button>
      {error && <p className="cl-error">{error}</p>}

      {result && (
        <div className="cl-result">
          <pre>{result}</pre>
          <button type="button" className="cl-btn" onClick={() => onSend(result, true)}>
            {s.sendToClass}
          </button>
        </div>
      )}
    </section>
  );
}
