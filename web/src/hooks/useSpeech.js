import { useCallback, useEffect, useRef, useState } from "react";

const LOCALES = { az: "az-AZ", ru: "ru-RU", en: "en-US", tr: "tr-TR" };

function getRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useSpeech(lang, onTranscript) {
  const Recognition = getRecognition();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Recognition || recognitionRef.current) return;
    const recognition = new Recognition();
    recognition.lang = LOCALES[lang] || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      callbackRef.current(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") setError(event.error);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    setError("");
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
    }
  }, [Recognition, lang]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    []
  );

  return { supported: !!Recognition, listening, error, start, stop };
}
