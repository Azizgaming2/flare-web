import { Capacitor } from "@capacitor/core";

export const ADS_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT || "";
export const DISPLAY_SLOT = import.meta.env.VITE_ADSENSE_DISPLAY_SLOT || "";
const REWARDED_SLOT = import.meta.env.VITE_ADSENSE_REWARDED_SLOT || "";

export function adsEnabled() {
  return !!ADS_CLIENT && !Capacitor.isNativePlatform();
}

export function rewardedEnabled() {
  return adsEnabled() && !!REWARDED_SLOT;
}

let loader = null;

export function loadAdsense() {
  if (!adsEnabled()) return Promise.resolve(false);
  if (loader) return loader;
  loader = new Promise((resolve) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
    if (import.meta.env.VITE_ADSENSE_TEST === "on") script.dataset.adtest = "on";
    script.onload = () => resolve(true);
    script.onerror = () => {
      loader = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return loader;
}

export async function requestRewardedAd(timeoutMs = 10000) {
  if (!rewardedEnabled() || !(await loadAdsense())) return null;
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve(null);
    }, timeoutMs);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({
      params: {
        google_ad_loaded_callback: (ad) => {
          if (settled) {
            ad?.disposeAd?.();
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(ad || null);
        },
        google_ad_format: "rewarded",
        google_ad_slot: Number(REWARDED_SLOT),
      },
    });
  });
}

export function showRewardedAd(ad) {
  return new Promise((resolve) => {
    try {
      ad.show((result) => resolve(result?.status === "viewed"));
    } catch {
      resolve(false);
    }
  });
}
