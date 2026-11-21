import { useState } from "react";

export default function AgeGate({ account, t, onConfirm, onLogOut }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!checked || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  if (account.suspended) {
    return (
      <div className="age-overlay">
        <div className="age-box">
          <h3>{t.suspendedTitle}</h3>
          <p>{t.suspendedText}</p>
          <button className="age-btn" onClick={onLogOut}>
            {t.logOut}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="age-overlay">
      <div className="age-box">
        <h3>{t.ageTitle}</h3>
        <p>{t.ageText}</p>
        <label className="age-check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{t.ageCheck}</span>
        </label>
        <button className="age-btn" onClick={handleConfirm} disabled={!checked || busy}>
          {t.ageContinue}
        </button>
        <button className="age-link" onClick={onLogOut}>
          {t.logOut}
        </button>
      </div>
    </div>
  );
}
