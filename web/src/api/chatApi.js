import { auth } from "../firebase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD ? "" : "http://localhost:8000");

export class ApiError extends Error {
  constructor(status, detail) {
    super(`API error: ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

function anonId() {
  try {
    let id = localStorage.getItem("flare_anon_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("flare_anon_id", id);
    }
    return id;
  } catch {
    return "";
  }
}

async function authHeaders() {
  const headers = { "Content-Type": "application/json", "X-Anon-Id": anonId() };
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, options = {}) {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

export async function streamChatMessage(messages, mode, chatId, model, { onToken, onDone, onTrim, onMemory, onStorageFull, search, signal }) {
  const headers = await authHeaders();

  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, mode, chat_id: chatId, model, search: !!search }),
    signal,
  });

  if (!response.ok || !response.body) {
    let detail = null;
    try {
      detail = (await response.json()).detail;
    } catch {}
    throw new ApiError(response.status, detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const line = event
        .split("\n")
        .find((candidate) => candidate.startsWith("data: "));
      if (!line) continue;

      const payload = line.slice(6);
      if (payload === "[DONE]") {
        onDone?.({});
        continue;
      }

      let data;
      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }

      if (data.type === "token") onToken?.(data.content || "");
      if (data.type === "error") throw new Error(data.message || "Streaming error");
      if (data.type === "trim") onTrim?.(data.remove);
      if (data.type === "done") onDone?.(data);
      if (data.type === "memory_updated") onMemory?.(data);
      if (data.type === "storage_full") onStorageFull?.();
    }
  }
}

export async function generateChatTitle(message, chatId) {
  try {
    const data = await request("/api/title", {
      method: "POST",
      body: JSON.stringify({ message, chat_id: chatId }),
    });
    return data.title || null;
  } catch {
    return null;
  }
}

export async function fetchChats(archived = false) {
  const data = await request(`/api/chats?archived=${archived}`);
  return data.chats;
}

export async function fetchChatMessages(chatId) {
  const data = await request(`/api/chats/${chatId}`);
  return data.messages;
}

export function archiveChat(chatId, archived) {
  return request(`/api/chats/${chatId}`, { method: "PATCH", body: JSON.stringify({ archived }) });
}

export function deleteChatRemote(chatId) {
  return request(`/api/chats/${chatId}`, { method: "DELETE" });
}

export function deleteAllChatsRemote() {
  return request("/api/chats", { method: "DELETE" });
}

export function fetchSettings() {
  return request("/api/settings");
}

export function saveSettings(patch) {
  return request("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
}

export async function fetchMemories() {
  const data = await request("/api/memories");
  return data.memories;
}

export function deleteMemory(memoryId) {
  return request(`/api/memories/${memoryId}`, { method: "DELETE" });
}

export function clearMemories() {
  return request("/api/memories", { method: "DELETE" });
}

export async function exportMemories() {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/api/memories/export`, { headers });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.text();
}

export function fetchStorage() {
  return request("/api/storage");
}

export async function fetchModels() {
  const response = await fetch(`${API_BASE_URL}/api/models`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.models;
}

export async function fetchUpdates() {
  const data = await request("/api/updates");
  return data.updates;
}

export async function fetchIsAdmin() {
  if (!auth.currentUser) return false;
  const data = await request("/api/me/admin");
  return data.admin;
}

export function createUpdate(payload) {
  return request("/api/admin/updates", { method: "POST", body: JSON.stringify(payload) });
}

export function deleteUpdate(id) {
  return request(`/api/admin/updates/${id}`, { method: "DELETE" });
}

export async function uploadUpdateMedia(file) {
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/admin/media`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  const data = await response.json();
  return data.name;
}

export function updateMediaUrl(name) {
  return `${API_BASE_URL}/api/updates/media/${name}`;
}

export function fetchAccountStatus() {
  return request("/api/me/status");
}

export function confirmAge() {
  return request("/api/me/age-confirm", { method: "POST" });
}

export async function fetchSuspended() {
  const data = await request("/api/admin/suspended");
  return data.users;
}

export function unsuspendUser(uid) {
  return request(`/api/admin/unsuspend/${uid}`, { method: "POST" });
}

export async function fetchAgeReviews() {
  const data = await request("/api/admin/age-reviews");
  return data.cases;
}

export function resolveAgeReview(id, action) {
  return request(`/api/admin/age-reviews/${id}/${action}`, { method: "POST" });
}

export function submitAppeal(form) {
  return request("/api/me/appeal", { method: "POST", body: JSON.stringify(form) });
}

export async function fetchAppeals() {
  const data = await request("/api/admin/appeals");
  return data.appeals;
}

export function resolveAppeal(id, action) {
  return request(`/api/admin/appeals/${id}/${action}`, { method: "POST" });
}

export async function extractFile(file) {
  if (!auth.currentUser) throw new ApiError(401, null);
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/files/extract`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "X-Filename": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) {
    let detail = null;
    try {
      detail = (await response.json()).detail;
    } catch {}
    throw new ApiError(response.status, detail);
  }
  return response.json();
}

export function sendFeedback(payload) {
  return request("/api/feedback", { method: "POST", body: JSON.stringify(payload) });
}

export function fetchFeedbackStats() {
  return request("/api/admin/feedback/stats");
}

export async function downloadFeedbackExport() {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE_URL}/api/admin/feedback/export`, { headers });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "flare-feedback.jsonl";
  link.click();
  URL.revokeObjectURL(link.href);
}