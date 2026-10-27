import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";

const MAX_LIMIT_USER = 100;
const MAX_LIMIT_ANON = 50;
const ANON_STORAGE_KEY = "flare_anon_id";

export function getAnonId() {
  let id = localStorage.getItem(ANON_STORAGE_KEY);
  if (!id) {
    id = "anon_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(ANON_STORAGE_KEY, id);
  }
  return id;
}

export function useLimit(user) {
  const [used, setUsed] = useState(0);
  const [resetAt, setResetAt] = useState(null);

  const key = user ? `limits/users/${user.uid}` : `limits/anon/${getAnonId()}`;
  const maxLimit = user ? MAX_LIMIT_USER : MAX_LIMIT_ANON;

  useEffect(() => {
    const limitRef = ref(db, key);
    const unsubscribe = onValue(limitRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUsed(0);
        setResetAt(null);
        return;
      }
      setUsed(data.used || 0);
      setResetAt(data.resetAt || null);
    });
    return unsubscribe;
  }, [key]);

  const percentUsed = Math.min(100, (used / maxLimit) * 100);
  const isLimitReached = percentUsed >= 100;

  return { used, maxLimit, percentUsed, isLimitReached, resetAt };
}