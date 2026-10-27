import { useEffect, useState } from "react";
import { getRandomPhrase } from "../data/loadingPhrases";

export default function LoadingIndicator({ lang, startedAt }) {
  const [phrase, setPhrase] = useState(() => getRandomPhrase(lang));
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  useEffect(() => {
    const phraseTimer = setInterval(() => setPhrase(getRandomPhrase(lang)), 2500);
    return () => clearInterval(phraseTimer);
  }, [lang]);

  useEffect(() => {
    const tick = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(tick);
  }, [startedAt]);

  return (
    <div className="message-bubble assistant loading">
      {phrase}... <span className="timer">{(elapsed / 1000).toFixed(1)}s</span>
    </div>
  );
}
