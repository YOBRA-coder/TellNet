import { useEffect, useState } from "react";

export function useOperatorSession() {
  const [isOperator, setIsOperator] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/operator/session", {
      credentials: "same-origin",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .then((authenticated) => {
        if (cancelled) return;
        setIsOperator(authenticated);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isPending: !ready,
    isOperator,
  };
}