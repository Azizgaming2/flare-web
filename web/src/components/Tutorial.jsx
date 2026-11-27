import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "../tutorial.css";

const PAD = 8;

function visibleRect(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  if (r.right <= 0 || r.bottom <= 0 || r.left >= window.innerWidth || r.top >= window.innerHeight) return null;
  return r;
}

export default function Tutorial({ t, onClose }) {
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [tipSize, setTipSize] = useState({ w: 320, h: 160 });
  const [leaving, setLeaving] = useState(false);
  const tipRef = useRef(null);

  const steps = useMemo(() => {
    if (!ready) return [];
    return t.tour.steps.filter((s) => visibleRect(document.querySelector(`[data-tour="${s.id}"]`)));
  }, [ready, t]);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready && steps.length === 0) onClose();
  }, [ready, steps.length, onClose]);

  const step = steps[index];

  useEffect(() => {
    if (!step) return undefined;
    function measure() {
      const el = document.querySelector(`[data-tour="${step.id}"]`);
      setRect(visibleRect(el));
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  useLayoutEffect(() => {
    if (tipRef.current) {
      setTipSize({ w: tipRef.current.offsetWidth, h: tipRef.current.offsetHeight });
    }
  }, [index, rect, steps.length]);

  function finish() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onClose, 350);
  }

  function next() {
    if (index >= steps.length - 1) finish();
    else setIndex(index + 1);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") finish();
      if (e.key === "Enter" || e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let tipStyle = { visibility: "hidden" };
  let hole = null;
  if (rect) {
    hole = {
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    };
    const below = rect.top + rect.height / 2 < vh / 2;
    const top = below
      ? Math.min(hole.top + hole.height + 14, vh - tipSize.h - 12)
      : Math.max(hole.top - tipSize.h - 14, 12);
    const left = Math.min(Math.max(rect.left + rect.width / 2 - tipSize.w / 2, 12), vw - tipSize.w - 12);
    tipStyle = { top, left };
  }

  const isLast = index >= steps.length - 1;

  return (
    <div className={`tour-root ${leaving ? "leaving" : ""}`} role="dialog" aria-modal="true">
      <div className="tour-blocker" />
      {hole && <div className="tour-hole" style={hole} />}
      {!hole && <div className="tour-dim" />}
      {step && (
        <div className="tour-tip" ref={tipRef} style={tipStyle} key={step.id}>
          <div className="tour-count">
            {index + 1} / {steps.length}
          </div>
          <div className="tour-title">{step.title}</div>
          <div className="tour-text">{step.text}</div>
          <div className="tour-actions">
            {!isLast ? (
              <button className="tour-skip" onClick={finish}>
                {t.tour.skip}
              </button>
            ) : (
              <span />
            )}
            <button className="tour-next" onClick={next}>
              {isLast ? t.tour.done : t.tour.next}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
