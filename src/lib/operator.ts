import { useEffect, useState } from "react";
import { getOperatorSession } from "@/lib/fn/public";

export function useOperatorSession() {
  const [isOperator, setIsOperator] = useState(false);
  const [who, setWho] = useState<{ name: string | null; owner: boolean; needsAccount: boolean }>({ name: null, owner: false, needsAccount: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getOperatorSession()
      .then((result) => {
        if (cancelled) return;

        setIsOperator(result.ok);
        setWho({ name: result.name, owner: result.owner, needsAccount: result.needsAccount });
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
    name: who.name,
    isOwner: who.owner,
    needsAccount: who.needsAccount,
  };
}