import { useEffect, useState } from "react";

const KEY = "telnet.operator";

export function markOperatorSession() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, "1");
}

export function clearOperatorSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function hasOperatorSession() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

/**
 * Operator access is a shared password only (no email / Grok sign-in).
 * Session flag is set after /api server verifies the password.
 */
export function useOperatorSession() {
  const [flag, setFlag] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFlag(hasOperatorSession());
    setReady(true);
  }, []);

  return {
    isPending: !ready,
    isOperator: flag,
  };
}
