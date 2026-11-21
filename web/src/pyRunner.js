const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

const WORKER_SOURCE = `
importScripts("${PYODIDE_URL}pyodide.js");
const ready = loadPyodide({ indexURL: "${PYODIDE_URL}" });
self.onmessage = async (e) => {
  const { id, code } = e.data;
  let out = "";
  try {
    const pyodide = await ready;
    pyodide.setStdout({ batched: (s) => { out += s + "\\n"; } });
    pyodide.setStderr({ batched: (s) => { out += s + "\\n"; } });
    await pyodide.loadPackagesFromImports(code);
    await pyodide.runPythonAsync(code);
    self.postMessage({ id, ok: true, output: out });
  } catch (err) {
    self.postMessage({ id, ok: false, output: out + String(err && err.message ? err.message : err) });
  }
};
`;

let worker = null;
let counter = 0;

function getWorker() {
  if (!worker) {
    const blob = new Blob([WORKER_SOURCE], { type: "text/javascript" });
    worker = new Worker(URL.createObjectURL(blob));
  }
  return worker;
}

function resetWorker() {
  if (worker) worker.terminate();
  worker = null;
}

export function runPython(code, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const w = getWorker();
    const id = ++counter;

    function finish(result) {
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      resolve(result);
    }

    function onMessage(e) {
      if (e.data.id === id) finish(e.data);
    }

    function onError(e) {
      resetWorker();
      finish({ ok: false, output: e.message || "Worker error" });
    }

    const timer = setTimeout(() => {
      resetWorker();
      finish({ ok: false, output: "Timed out after " + timeoutMs / 1000 + " s" });
    }, timeoutMs);

    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ id, code });
  });
}
