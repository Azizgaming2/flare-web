import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTACT_EMAIL, LEGAL, LEGAL_LANGS } from "../src/legal.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const SITE = "https://flareai.dpdns.org";
const NAMES = { privacy: "Məxfilik Siyasəti", terms: "İstifadə Şərtləri" };

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderParagraphs(lines) {
  let html = "";
  let items = [];
  const flush = () => {
    if (items.length) {
      html += `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
      items = [];
    }
  };
  for (const line of lines) {
    if (line.startsWith("- ")) {
      items.push(line.slice(2));
    } else {
      flush();
      html += `<p>${esc(line)}</p>`;
    }
  }
  flush();
  return html;
}

function renderDoc(doc) {
  const langBar = LEGAL_LANGS.map(([code, label]) => `<a href="#${code}">${esc(label)}</a>`).join("");
  const sections = LEGAL_LANGS.map(([code]) => {
    const c = LEGAL[doc][code];
    const body = c.sections.map((s) => `<h2>${esc(s.h)}</h2>${renderParagraphs(s.p)}`).join("");
    return `<section class="doc" id="${code}" lang="${code}"><h1>${esc(c.title)}</h1><p class="updated">${esc(c.updated)}</p>${body}</section>`;
  }).join("");
  const title = `${NAMES[doc]} — Flare AI`;
  return `<!DOCTYPE html>
<html lang="az">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="Flare AI ${esc(NAMES[doc].toLowerCase())}. Azərbaycan, rus və ingilis dillərində.">
<link rel="canonical" href="${SITE}/${doc}">
<link rel="icon" type="image/png" href="/flare-icon.png">
<meta name="theme-color" content="#0c0c0d">
<link rel="stylesheet" href="/static-pages.css">
</head>
<body>
<div class="wrap">
<header class="top">
<a class="brand" href="/about"><svg viewBox="0 0 32 32" fill="none" stroke="#f27a2c" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M16 3v26M3 16h26M7 7l18 18M25 7L7 25"/></svg><span>Flare AI</span></a>
<nav class="nav" aria-label="Əsas"><a href="/">Flare AI-ı aç</a><a href="/${doc === "privacy" ? "terms" : "privacy"}">${doc === "privacy" ? "Şərtlər" : "Məxfilik"}</a></nav>
</header>
<main>
<div class="langs">${langBar}</div>
${sections}
</main>
<footer><p>© 2026 Flare Corporation · <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a></p></footer>
</div>
</body>
</html>
`;
}

for (const doc of ["privacy", "terms"]) {
  writeFileSync(join(OUT, `${doc}.html`), renderDoc(doc), "utf-8");
}
console.log("privacy.html and terms.html written");
