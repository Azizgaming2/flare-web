import { useState } from "react";
import { classStrings } from "../../locales/classStrings";
import ClassLobby from "./ClassLobby";
import ClassRoom from "./ClassRoom";
import "../../class.css";

export default function ClassMode({ user, lang, onClose }) {
  const s = classStrings[lang] || classStrings.az;
  const [code, setCode] = useState("");

  return (
    <div className="cl-root">
      {code ? (
        <ClassRoom code={code} userName={user?.nickname || user?.name || ""} lang={lang} s={s} onLeave={() => setCode("")} />
      ) : (
        <ClassLobby s={s} onEnter={setCode} onClose={onClose} />
      )}
    </div>
  );
}
