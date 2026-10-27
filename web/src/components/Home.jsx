export default function Home({ greeting, t, onPick }) {
  return (
    <div className="home">
      <div className="home-hero">
        <svg className="home-spark" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 1l2.3 8.7L23 12l-8.7 2.3L12 23l-2.3-8.7L1 12l8.7-2.3z" />
        </svg>
        <h1 className="home-greet">{greeting}</h1>
      </div>
      <div className="home-chips">
        {t.suggestions.map((item) => (
          <button key={item.title} className="home-chip" onClick={() => onPick(item.prompt)}>
            {item.title}
          </button>
        ))}
      </div>
    </div>
  );
}