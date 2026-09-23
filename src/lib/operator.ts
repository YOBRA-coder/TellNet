import { useEffect, useState } from "react";
import { getOperatorSession } from "@/lib/fn/public";

export function useOperatorSession() {
  const [isOperator, setIsOperator] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getOperatorSession()
      .then((result) => {
        if (cancelled) return;

        setIsOperator(result.ok);
        setReady(true);
      })
      .catch((error) => {
        console.error("[operator] session check failed:", error);

        if (!cancelled) {
          setIsOperator(false);
          setReady(true);
        }
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