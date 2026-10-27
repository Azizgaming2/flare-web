import { useState } from "react";
import { LEGAL, LEGAL_LANGS } from "../legal";

export default function LegalViewer({ t, defaultLang }) {
  const [doc, setDoc] = useState("privacy");
  const [lang, setLang] = useState(defaultLang);
  const content = LEGAL[doc][lang];

  return (
    <div className="legal">
      <div className="legal-bar">
        <div className="legal-group">
          <button className={`legal-btn ${doc === "privacy" ? "active" : ""}`} onClick={() => setDoc("privacy")}>
            {t.privacyPolicy}
          </button>
          <button className={`legal-btn ${doc === "terms" ? "active" : ""}`} onClick={() => setDoc("terms")}>
            {t.termsOfService}
          </button>
        </div>
        <div className="legal-group">
          {LEGAL_LANGS.map(([code, label]) => (
            <button key={code} className={`legal-btn ${lang === code ? "active" : ""}`} onClick={() => setLang(code)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <article className="legal-doc">
        <h2>{content.title}</h2>
        <div className="legal-updated">{content.updated}</div>
        {content.sections.map((section) => (
          <section key={section.h}>
            <h3>{section.h}</h3>
            {section.p.map((line) =>
              line.startsWith("- ") ? (
                <div key={line} className="legal-li">
                  {line.slice(2)}
                </div>
              ) : (
                <p key={line}>{line}</p>
              )
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
