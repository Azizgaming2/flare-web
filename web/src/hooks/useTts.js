import { useSyncExternalStore } from "react";
import { fetchSpeech } from "../api/chatApi";

let state = { key: null, status: "idle" };
let audio = null;
let controller = null;
const listeners = new Set();

function setState(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function stop() {
  if (controller) controller.abort();
  controller = null;
  if (audio) {
    audio.pause();
    URL.revokeObjectURL(audio.src);
    audio = null;
  }
  setState({ key: null, status: "idle" });
}

async function play(key, text, model) {
  stop();
  const mine = new AbortController();
  controller = mine;
  setState({ key, status: "loading" });
  try {
    const blob = await fetchSpeech(text, model, mine.signal);
    if (mine.signal.aborted) return;
    const element = new Audio(URL.createObjectURL(blob));
    element.onended = stop;
    element.onerror = stop;
    audio = element;
    await element.play();
    if (!mine.signal.aborted) setState({ key, status: "playing" });
  } catch {
    if (!mine.signal.aborted) stop();
  }
}

export function useTts(key) {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  const active = snapshot.key === key;
  return {
    status: active ? snapshot.status : "idle",
    toggle: (text, model = "tentium") => (active ? stop() : play(key, text, model)),
  };
}
