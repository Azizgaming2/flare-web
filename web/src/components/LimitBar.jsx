export default function LimitBar({ percentUsed, isLimitReached, isLoggedIn, t }) {
  return (
    <div className="limit-bar-wrapper">
      <div className="limit-bar-track">
        <div
          className={`limit-bar-fill ${isLimitReached ? "danger" : ""}`}
          style={{ width: `${percentUsed}%` }}
        />
      </div>
      {isLimitReached && (
        <div className="limit-bar-message">
          {isLoggedIn ? t.limitReachedLoggedIn : t.limitReachedAnon}
        </div>
      )}
    </div>
  );
}