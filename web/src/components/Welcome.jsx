import { useState } from "react";
import { translations, languageOptions } from "../locales/translations";
import "../welcome.css";

export default function Welcome({ lang, setLang, onDone }) {
  const [leaving, setLeaving] = useState(false);
  const t = translations[lang];

  function handleContinue() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 380);
  }

  const noteParts = t.welcomeNote.split(/(\{terms\}|\{privacy\})/);

  return (
    <div className={`welcome-overlay ${leaving ? "leaving" : ""}`} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-glow" />
      <div className="welcome-box">
        <img src="/flare-logo.svg" alt="Flare" className="welcome-logo" />
        <h1 id="welcome-title" className="welcome-title" key={`title-${lang}`}>
          {t.welcomeTitle}
        </h1>
        <p className="welcome-sub" key={`sub-${lang}`}>
          {t.welcomeSubtitle}
        </p>
        <div className="welcome-lang-label">{t.welcomeLanguage}</div>
        <div className="welcome-langs">
          {languageOptions.map((option, i) => (
            <button
              key={option.code}
              className={`welcome-lang ${lang === option.code ? "active" : ""}`}
              style={{ "--i": i }}
              aria-pressed={lang === option.code}
              onClick={() => setLang(option.code)}
            >
              <span>{option.label}</span>
              <span className="welcome-check">{lang === option.code ? "✓" : ""}</span>
            </button>
          ))}
        </div>
        <button className="welcome-continue" onClick={handleContinue}>
          {t.welcomeContinue}
        </button>
        <p className="welcome-note" key={`note-${lang}`}>
          {noteParts.map((part, i) => {
            if (part === "{terms}") {
              return (
                <a key={i} href="/terms.html" target="_blank" rel="noopener noreferrer">
                  {t.termsOfService}
                </a>
              );
            }
            if (part === "{privacy}") {
              return (
                <a key={i} href="/privacy.html" target="_blank" rel="noopener noreferrer">
                  {t.privacyPolicy}
                </a>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
        <div className="welcome-company">© {new Date().getFullYear()} Flare Corporation</div>
      </div>
    </div>
  );
}
