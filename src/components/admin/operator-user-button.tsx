import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { logoutOperator } from "@/lib/fn/public";

export function OperatorUserButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;

    setBusy(true);

    try {
      const result = await logoutOperator();

      if (!result.ok) {
        throw new Error("Sign-out failed");
      }

      await navigate({
        to: "/login",
        replace: true,
      });
    } catch (error) {
      console.error("[operator] sign out failed:", error);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="w-full rounded-md px-2.5 py-2 text-left text-sm text-muted hover:bg-raised hover:text-fg disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}