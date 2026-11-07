import { auth } from "../firebase";
import { API_BASE_URL } from "./chatApi";

export class ClassApiError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function call(path, options = {}) {
  if (!auth.currentUser) throw new ClassApiError("login_required");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!response.ok) {
    let detail = "generic";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {}
    throw new ClassApiError(detail);
  }
  return response;
}

const json = (body) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const createClass = (title) => call("/api/class/create", json({ title })).then((r) => r.json());

export const getClass = (code) => call(`/api/class/${code}`).then((r) => r.json());

export const uploadClassFile = (code, file) =>
  call(`/api/class/${code}/upload`, {
    method: "POST",
    headers: {
      "X-File-Name": encodeURIComponent(file.name),
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

export const fetchClassFile = (code, id) => call(`/api/class/${code}/file/${id}`).then((r) => r.blob());

export const generateTaskIdea = (code, payload) =>
  call(`/api/class/${code}/task-idea`, json(payload)).then((r) => r.json());

export function classSocketUrl(code) {
  const base = API_BASE_URL || window.location.origin;
  return `${base.replace(/^http/, "ws")}/ws/class/${code}`;
}
