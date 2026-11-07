import { useState } from "react";
import { createClass, getClass } from "../../api/classApi";

export default function ClassLobby({ s, onEnter, onClose }) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setError("");
    setBusy(true);
    try {
      onEnter(await action());
    } catch (err) {
      setError(s.errors[err.code] || s.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  const create = () => run(async () => (await createClass(title)).code);

  const join = () =>
    run(async () => {
      const value = code.trim().toUpperCase();
      if (value.length !== 6) throw Object.assign(new Error("not_found"), { code: "not_found" });
      return (await getClass(value)).code;
    });

  return (
    <div className="cl-lobby">
      <div className="cl-lobby-top">
        <button type="button" className="cl-btn" onClick={onClose}>{s.back}</button>
        <h2>{s.title}</h2>
      </div>
      <div className="cl-cards">
        <section className="cl-card">
          <h3>{s.createTitle}</h3>
          <p>{s.createDesc}</p>
          <input value={title} maxLength={60} placeholder={s.titlePlaceholder} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" className="cl-btn pri" onClick={create} disabled={busy}>{s.createBtn}</button>
        </section>
        <section className="cl-card">
          <h3>{s.joinTitle}</h3>
          <p>{s.joinDesc}</p>
          <input
            className="cl-code-input"
            value={code}
            maxLength={6}
            placeholder={s.codePlaceholder}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <button type="button" className="cl-btn pri" onClick={join} disabled={busy}>{s.joinBtn}</button>
        </section>
      </div>
      {error && <p className="cl-error">{error}</p>}
    </div>
  );
}
