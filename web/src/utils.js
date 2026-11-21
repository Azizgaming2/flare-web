export function formatDuration(ms) {
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const UNWRAP_LANGUAGES = ["md", "markdown", "text", "txt", "plaintext", "answer"];

export function normalizeAssistant(content) {
  const source = String(content ?? "");
  const withoutTags = source.replace(/^[ \t]*<\/?answer>[ \t]*\n?/gim, "");
  const hadTag = withoutTags !== source;
  const match = /^\s*```(\w*)\n([\s\S]*?)(?:\n```)?\s*$/.exec(withoutTags);
  if (match && (hadTag || UNWRAP_LANGUAGES.includes(match[1].toLowerCase()))) {
    return match[2];
  }
  return withoutTags;
}
