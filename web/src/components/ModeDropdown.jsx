import { useState, useRef, useEffect } from "react";

export default function ModeDropdown({ mode, setMode, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const modes = [
    { id: "fast", label: t.fastMode },
    { id: "deepthink", label: t.deepThinkMode },
    { id: "feynman", label: t.feynmanMode || "Feynman" },
  ];
  const current = modes.find((m) => m.id === mode) || modes[0];

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
        {current.label} ▾
      </button>
      {open && (
        <div className="mode-menu">
          {modes.map((m) => (
            <div
              key={m.id}
              className={`mode-menu-item ${mode === m.id ? "active" : ""}`}
              onClick={() => {
                setMode(m.id);
                setOpen(false);
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
