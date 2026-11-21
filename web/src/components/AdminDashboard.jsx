import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiRequest,
  fetchAgeReviews,
  resolveAgeReview,
  fetchAppeals,
  resolveAppeal,
  fetchUpdates,
  createUpdate,
  deleteUpdate,
  uploadUpdateMedia,
  downloadFeedbackExport,
} from "../api/chatApi";
import "../admin.css";

const POINTS = 150;

function fmtDuration(seconds) {
  if (seconds == null) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function fmtGb(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function fmtDate(seconds) {
  return seconds ? new Date(seconds * 1000).toLocaleString() : "-";
}

function Chart({ series, max = 100, unit }) {
  const w = 300;
  const h = 100;
  return (
    <div className="ad-chart-wrap">
      <svg className="ad-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} className="ad-grid" />
        ))}
        {series.map((s, index) => {
          const offset = POINTS - s.values.length;
          const points = s.values
            .map((v, i) =>
              v == null ? null : `${((i + offset) / (POINTS - 1)) * w},${h - (Math.min(v, max) / max) * h}`
            )
            .filter(Boolean)
            .join(" ");
          return <polyline key={s.name} points={points} className={`ad-line ad-line-${index}`} />;
        })}
      </svg>
      <div className="ad-legend">
        {series.map((s, index) => {
          const last = s.values[s.values.length - 1];
          return (
            <span key={s.name} className={`ad-legend-${index}`}>
              {s.name}: {last == null ? "-" : `${Math.round(last)}${unit}`}
            </span>
          );
        })}
        <span className="ad-legend-range">5 min</span>
      </div>
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`ad-panel ${className}`}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Terminal() {
  const [lines, setLines] = useState([{ kind: "out", text: "Type /help to list commands" }]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);

  async function submit() {
    const command = input.trim();
    if (!command) return;
    setInput("");
    setLines((prev) => [...prev, { kind: "in", text: command }]);
    try {
      const result = await apiRequest("/api/admin/command", { method: "POST", body: JSON.stringify({ command }) });
      setLines((prev) => [...prev, { kind: "out", text: result.output }]);
    } catch {
      setLines((prev) => [...prev, { kind: "out", text: "Command failed" }]);
    }
  }

  return (
    <div className="ad-terminal">
      <div className="ad-term-body">
        {lines.map((line, i) => (
          <pre key={i} className={line.kind === "in" ? "ad-term-in" : ""}>
            {line.kind === "in" ? `> ${line.text}` : line.text}
          </pre>
        ))}
        <div ref={endRef} />
      </div>
      <input
        className="ad-input"
        value={input}
        placeholder="/help"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
    </div>
  );
}

function ServerControl({ owner }) {
  const [data, setData] = useState(null);
  const [models, setModels] = useState([]);
  const [offline, setOffline] = useState(false);
  const [hist, setHist] = useState({ cpu: [], gpu: [], cpuT: [], gpuT: [] });

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const [m, r] = await Promise.all([
          apiRequest("/api/admin/metrics"),
          apiRequest("/api/admin/running-models"),
        ]);
        if (!alive) return;
        setData(m);
        setModels(r.models);
        setOffline(false);
        const push = (arr, v) => [...arr, v].slice(-POINTS);
        setHist((prev) => ({
          cpu: push(prev.cpu, m.cpu.util),
          gpu: push(prev.gpu, m.gpu ? m.gpu.util : null),
          cpuT: push(prev.cpuT, m.cpu.temp),
          gpuT: push(prev.gpuT, m.gpu ? m.gpu.temp : null),
        }));
      } catch {
        if (alive) setOffline(true);
      }
    }
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const gpu = data?.gpu;

  return (
    <div className="ad-grid-layout">
      {offline && <div className="ad-warn">Server is not responding</div>}
      <Panel title="GPU" className="ad-gpu">
        {gpu ? (
          <>
            <div className="ad-sub">{gpu.name}</div>
            <Chart series={[{ name: "GPU", values: hist.gpu }]} unit="%" />
            <div className="ad-sub">
              VRAM {Math.round(gpu.mem_used)} / {Math.round(gpu.mem_total)} MB
            </div>
          </>
        ) : (
          <div className="ad-empty">No GPU detected</div>
        )}
      </Panel>
      <Panel title="CPU" className="ad-cpu">
        <div className="ad-sub">
          {data?.cpu_name || "-"} ({data?.cpu.cores} threads)
        </div>
        <Chart series={[{ name: "CPU", values: hist.cpu }]} unit="%" />
        <div className="ad-sub">
          RAM {data?.ram ? `${fmtGb(data.ram.used)} / ${fmtGb(data.ram.total)}` : "psutil is not installed"}
        </div>
      </Panel>
      <Panel title="Uptime" className="ad-uptime">
        <div className="ad-stat">
          <span>API</span>
          <b>{fmtDuration(data?.api_uptime)}</b>
        </div>
        <div className="ad-stat">
          <span>Host</span>
          <b>{fmtDuration(data?.host_uptime)}</b>
        </div>
        <div className="ad-stat">
          <span>Server</span>
          <b>{data ? `${data.host} (${data.system})` : "-"}</b>
        </div>
      </Panel>
      <Panel title="Temperature" className="ad-temp">
        <Chart
          max={110}
          unit=" C"
          series={[
            { name: "CPU", values: hist.cpuT },
            { name: "GPU", values: hist.gpuT },
          ]}
        />
        {data && data.cpu.temp == null && !gpu && <div className="ad-sub">No temperature sensor available</div>}
      </Panel>
      {owner && (
        <Panel title="General Commands" className="ad-cmd">
          <Terminal />
        </Panel>
      )}
      <Panel title="Current Models" className="ad-models">
        {models.length === 0 && <div className="ad-empty">No model is loaded</div>}
        {models.map((m, i) => (
          <div key={m.name} className="ad-row">
            <span>
              {i + 1}. {m.name}
            </span>
            <span className="ad-muted">
              {fmtDuration(m.uptime)} - {fmtGb(m.size)}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function ManageAuthors() {
  const [authors, setAuthors] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiRequest("/api/admin/authors")
      .then((r) => setAuthors(r.authors))
      .catch(() => setError("Failed to load"));
  }, []);

  useEffect(load, [load]);

  async function add() {
    setError("");
    try {
      await apiRequest("/api/admin/authors", { method: "POST", body: JSON.stringify({ email }) });
      setEmail("");
      load();
    } catch {
      setError("Invalid email");
    }
  }

  async function remove(target) {
    if (!window.confirm(`Remove ${target}?`)) return;
    await apiRequest("/api/admin/authors", { method: "DELETE", body: JSON.stringify({ email: target }) });
    load();
  }

  return (
    <Panel title="Manage Authors">
      <div className="ad-form-row">
        <input
          className="ad-input"
          type="email"
          placeholder="author@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="ad-btn" onClick={add} disabled={!email.trim()}>
          Add
        </button>
      </div>
      {error && <div className="ad-warn">{error}</div>}
      {authors.map((a) => (
        <div key={a.email} className="ad-row">
          <span>{a.email}</span>
          <span className="ad-muted">
            {a.role}
            {a.role === "author" && (
              <button className="ad-btn ad-danger" onClick={() => remove(a.email)}>
                Remove
              </button>
            )}
          </span>
        </div>
      ))}
    </Panel>
  );
}

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(() => {
    apiRequest("/api/admin/accounts")
      .then((r) => setAccounts(r.accounts))
      .catch(() => {});
    fetchAgeReviews().then(setReviews).catch(() => {});
    fetchAppeals().then(setAppeals).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function act(uid, action, question) {
    if (!window.confirm(question)) return;
    await apiRequest(`/api/admin/accounts/${uid}/${action}`, { method: "POST" });
    load();
  }

  async function review(id, action) {
    if (!window.confirm(action === "freeze" ? "Freeze this account?" : "Dismiss this suspicion?")) return;
    await resolveAgeReview(id, action);
    load();
  }

  async function appeal(id, action) {
    if (!window.confirm(action === "approve" ? "Approve and whitelist this email?" : "Reject this appeal?")) return;
    await resolveAppeal(id, action);
    load();
  }

  const shown = accounts.filter((a) => a.email.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <Panel title={`Age Suspicions (${reviews.length})`}>
        {reviews.length === 0 && <div className="ad-empty">No pending cases</div>}
        {reviews.map((c) => (
          <div key={c.id} className="ad-case">
            <div className="ad-row">
              <b>{c.email || c.uid}</b>
              <span className="ad-muted">{fmtDate(c.created_at)}</span>
            </div>
            <div className="ad-sub">{c.reason}</div>
            {c.messages.map((m, i) => (
              <div key={i} className="ad-quote">
                {m}
              </div>
            ))}
            <div className="ad-actions">
              <button className="ad-btn ad-danger" onClick={() => review(c.id, "freeze")}>
                Freeze
              </button>
              <button className="ad-btn" onClick={() => review(c.id, "dismiss")}>
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </Panel>
      <Panel title={`Appeals (${appeals.length})`}>
        {appeals.length === 0 && <div className="ad-empty">No pending appeals</div>}
        {appeals.map((a) => (
          <div key={a.id} className="ad-case">
            <div className="ad-row">
              <b>
                {a.first_name} {a.last_name} - {a.class_name}
              </b>
              <span className="ad-muted">{a.email}</span>
            </div>
            <div className="ad-actions">
              <button className="ad-btn" onClick={() => appeal(a.id, "approve")}>
                Approve
              </button>
              <button className="ad-btn ad-danger" onClick={() => appeal(a.id, "reject")}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </Panel>
      <Panel title={`Accounts (${accounts.length})`}>
        <input
          className="ad-input"
          placeholder="Search email"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="ad-table">
          {shown.map((a) => (
            <div key={a.uid} className="ad-case">
              <div className="ad-row">
                <b>{a.email || a.uid}</b>
                <span className={`ad-badge ad-${a.status}`}>{a.status}</span>
              </div>
              <div className="ad-sub">Joined: {fmtDate(a.joined_at)}</div>
              <div className="ad-actions">
                {a.status === "active" && (
                  <button className="ad-btn" onClick={() => act(a.uid, "freeze", "Freeze this account?")}>
                    Freeze
                  </button>
                )}
                {a.status === "frozen" && (
                  <button className="ad-btn" onClick={() => act(a.uid, "unfreeze", "Unfreeze this account?")}>
                    Unfreeze
                  </button>
                )}
                {a.status === "banned" ? (
                  <button className="ad-btn" onClick={() => act(a.uid, "unban", "Unban this account?")}>
                    Unban
                  </button>
                ) : (
                  <button className="ad-btn ad-danger" onClick={() => act(a.uid, "ban", "Ban this account permanently?")}>
                    Ban
                  </button>
                )}
                <button
                  className="ad-btn ad-danger"
                  onClick={() => act(a.uid, "delete-data", "Delete all chats and memories of this user?")}
                >
                  Delete data
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function Rlhf() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiRequest("/api/admin/feedback/overview")
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <Panel title="RLHF Data">Loading...</Panel>;
  const maxCount = Math.max(1, ...data.reasons.map((r) => r.count));

  return (
    <>
      <Panel title="RLHF Data">
        <div className="ad-stat">
          <span>Likes</span>
          <b>{data.stats.up}</b>
        </div>
        <div className="ad-stat">
          <span>Dislikes</span>
          <b>{data.stats.down}</b>
        </div>
        <button className="ad-btn" onClick={() => downloadFeedbackExport().catch(() => {})}>
          Export JSONL
        </button>
      </Panel>
      <Panel title="Dislike Reasons">
        {data.reasons.length === 0 && <div className="ad-empty">No data</div>}
        {data.reasons.map((r) => (
          <div key={r.reason} className="ad-bar-row">
            <span>{r.reason}</span>
            <div className="ad-bar">
              <i style={{ width: `${(r.count / maxCount) * 100}%` }} />
            </div>
            <b>{r.count}</b>
          </div>
        ))}
      </Panel>
      <Panel title="Recent Feedback">
        {data.items.map((item, i) => (
          <div key={i} className="ad-case">
            <div className="ad-row">
              <b>{item.rating === "up" ? "Like" : "Dislike"}</b>
              <span className="ad-muted">
                {item.mode} - {fmtDate(item.created)}
              </span>
            </div>
            {item.reason && <div className="ad-sub">Reason: {item.reason}</div>}
            <div className="ad-quote">{item.prompt}</div>
            <div className="ad-quote">{item.response}</div>
          </div>
        ))}
      </Panel>
    </>
  );
}

function Shares() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState([]);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetchUpdates().then(setItems).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    setBusy(true);
    setError("");
    try {
      for (const file of files) {
        const name = await uploadUpdateMedia(file);
        setMedia((prev) => [...prev, name].slice(0, 6));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createUpdate({ title: title.trim(), body, media });
      setTitle("");
      setBody("");
      setMedia([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this post?")) return;
    await deleteUpdate(id);
    load();
  }

  return (
    <>
      <Panel title="New Post">
        <input className="ad-input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="ad-input ad-textarea"
          placeholder="Text (Markdown supported)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="ad-form-row">
          <label className="ad-btn">
            Add media ({media.length}/6)
            <input type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={handleFiles} />
          </label>
          <button className="ad-btn" onClick={publish} disabled={busy}>
            Publish
          </button>
        </div>
        {error && <div className="ad-warn">{error}</div>}
      </Panel>
      <Panel title={`Posts (${items.length})`}>
        {items.map((u) => (
          <div key={u.id} className="ad-row">
            <span>{u.title}</span>
            <span className="ad-muted">
              {new Date(u.created).toLocaleDateString()}
              <button className="ad-btn ad-danger" onClick={() => remove(u.id)}>
                Delete
              </button>
            </span>
          </div>
        ))}
      </Panel>
    </>
  );
}

export default function AdminDashboard({ onClose }) {
  const [access, setAccess] = useState(null);
  const [tab, setTab] = useState("server");

  useEffect(() => {
    apiRequest("/api/me/admin")
      .then(setAccess)
      .catch(() => setAccess({ admin: false, owner: false }));
  }, []);

  const tabs = [
    ["server", "Server Control"],
    ...(access?.owner ? [["authors", "Manage Authors"]] : []),
    ["accounts", "Age Detection And Email"],
    ["rlhf", "RLHF Data"],
    ["shares", "Shares"],
  ];

  return (
    <div className="ad-root">
      <header className="ad-top">
        <button className="ad-btn" onClick={onClose}>
          Back
        </button>
        <h2>Admin Dashboard</h2>
      </header>
      {access && !access.admin ? (
        <div className="ad-empty ad-noaccess">No access</div>
      ) : (
        <div className="ad-body">
          <nav className="ad-nav">
            {tabs.map(([id, label]) => (
              <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
          <main className="ad-main">
            {access && tab === "server" && <ServerControl owner={access.owner} />}
            {tab === "authors" && <ManageAuthors />}
            {tab === "accounts" && <Accounts />}
            {tab === "rlhf" && <Rlhf />}
            {tab === "shares" && <Shares />}
          </main>
        </div>
      )}
    </div>
  );
}
