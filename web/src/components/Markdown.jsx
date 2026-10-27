import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function nodeText(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return nodeText(node.props?.children);
}

function CodeBlock({ children, labels }) {
  const [copied, setCopied] = useState(false);
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className = codeElement?.props?.className || "";
  const language = /language-([\w-]+)/.exec(className)?.[1] || "";
  const text = nodeText(codeElement?.props?.children).replace(/\n$/, "");

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{language || "code"}</span>
        <button className="code-copy" onClick={handleCopy}>
          {copied ? labels.copied : labels.copy}
        </button>
      </div>
      <pre>{children}</pre>
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
