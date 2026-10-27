import { useState, useRef, useEffect } from "react";

export default function ModeDropdown({ mode, setMode, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="mode-dropdown-wrapper" ref={ref}>
      <button className="mode-btn" onClick={() => setOpen(!open)}>
        {mode === "deepthink" ? t.deepThinkMode : t.fastMode} ▾
      </button>
      {open && (
        <div className="mode-menu">
          <div
            className={`mode-menu-item ${mode === "fast" ? "active" : ""}`}
            onClick={() => {
              setMode("fast");
              setOpen(false);
            }}
          >
            {t.fastMode}
          </div>
          <div
            className={`mode-menu-item ${mode === "deepthink" ? "active" : ""}`}
            onClick={() => {
              setMode("deepthink");
              setOpen(false);
            }}
          >
            {t.deepThinkMode}
          </div>
        </div>
      )}
    </div>
  );
}