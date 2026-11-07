import { useEffect, useRef } from "react";

function initials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function VideoTile({ stream, name, flag, off, muted = false, big = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== (stream || null)) el.srcObject = stream || null;
  }, [stream]);

  return (
    <div className={`cl-tile${big ? " big" : ""}`}>
      <video ref={ref} autoPlay playsInline muted={muted} className={off ? "cl-vhide" : ""} />
      {off && <div className="cl-avatar">{initials(name)}</div>}
      <span className="cl-tag">{flag ? `${name} (${flag})` : name}</span>
    </div>
  );
}
