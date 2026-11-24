import { useEffect, useRef } from "react";
import { ADS_CLIENT, DISPLAY_SLOT, adsEnabled, loadAdsense } from "../adsense";

const GUARDED = [".app-layout", ".sidebar"];

export default function AdSlot() {
  const pushed = useRef(false);
  const enabled = adsEnabled() && !!DISPLAY_SLOT;

  useEffect(() => {
    if (!enabled) return undefined;
    const nodes = GUARDED.map((selector) => document.querySelector(selector)).filter(Boolean);
    const restore = (el) => {
      if (el.style.height === "auto") el.style.removeProperty("height");
    };
    nodes.forEach(restore);
    const observer = new MutationObserver((records) => records.forEach((record) => restore(record.target)));
    nodes.forEach((el) => observer.observe(el, { attributes: true, attributeFilter: ["style"] }));
    return () => observer.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    loadAdsense().then((ok) => {
      if (!ok) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {}
    });
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "0.5rem 0" }}>
      <ins
        className="adsbygoogle"
        style={{ display: "inline-block", width: "200px", height: "200px" }}
        data-ad-client={ADS_CLIENT}
        data-ad-slot={DISPLAY_SLOT}
        data-adtest={import.meta.env.VITE_ADSENSE_TEST === "on" ? "on" : undefined}
      />
    </div>
  );
}
