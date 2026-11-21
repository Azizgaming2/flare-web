import { Component } from "react";

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "24px",
    background: "#0a0a0a",
    color: "#eaeaea",
    textAlign: "center",
  },
  pre: {
    maxWidth: "640px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: "12px",
    opacity: 0.7,
  },
  button: {
    padding: "8px 18px",
    border: "1px solid #eaeaea",
    borderRadius: "8px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
  },
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI crash:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={styles.wrap}>
        <h2>Flare AI</h2>
        <p>Səhifədə xəta baş verdi.</p>
        <pre style={styles.pre}>{String(this.state.error?.message || this.state.error)}</pre>
        <button style={styles.button} onClick={() => window.location.reload()}>
          Səhifəni yenilə
        </button>
      </div>
    );
  }
}
