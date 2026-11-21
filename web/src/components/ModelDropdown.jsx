import { useState, useRef, useEffect } from "react";

export default function ModelDropdown({ model, setModel, models, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (models.length === 0) return null;
  const current = models.find((m) => m.id === model) || models[0];

  return (
    <div className="mode-dropdown-wrapper" ref={ref}>
      <button className="mode-btn" onClick={() => setOpen(!open)}>
        {current.name} ▾
      </button>
      {open && (
        <div className="mode-menu">
          {models.map((m) => (
            <div
              key={m.id}
              className={`mode-menu-item ${m.id === model ? "active" : ""}`}
              style={m.available ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
              onClick={() => {
                if (!m.available) return;
                setModel(m.id);
                setOpen(false);
              }}
            >
              {m.name}
              {m.available ? "" : ` (${t.modelSoon || "soon"})`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}