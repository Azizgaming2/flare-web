const SEEN_KEY = "flare_updates_seen";

export function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) || "";
  } catch {
    return "";
  }
}

export function writeSeen(value) {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    return;
  }
}
