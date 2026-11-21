import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { runPython } from "../pyRunner";

function nodeText(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return nodeText(node.props?.children);
}

function CodeBlock({ children, labels }) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className = codeElement?.props?.className || "";
  const language = /language-([\w-]+)/.exec(className)?.[1] || "";
  const text = nodeText(codeElement?.props?.children).replace(/\n$/, "");
  const runnable = language === "python" || language === "py";

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleRun() {
    setRunning(true);
    setResult(await runPython(text));
    setRunning(false);
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{language || "code"}</span>
        <span className="code-actions">
          {runnable && (
            <button className="code-copy" onClick={handleRun} disabled={running}>
              {running ? labels.running || "Running..." : labels.run || "Run"}
            </button>
          )}
          <button className="code-copy" onClick={handleCopy}>
            {copied ? labels.copied : labels.copy}
          </button>
        </span>
      </div>
      <pre>{children}</pre>
      {result && (
        <pre className={`code-output ${result.ok ? "" : "code-output-error"}`}>
          {result.output.trim() || "(no output)"}
        </pre>
      )}
    </div>
  );
}

export default function Markdown({ content, labels }) {
  const components = useMemo(
    () => ({
      pre: ({ children }) => <CodeBlock labels={labels}>{children}</CodeBlock>,
      a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      table: ({ node, ...props }) => (
        <div className="table-wrap">
          <table {...props} />
        </div>
      ),
    }),
    [labels]
  );

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
