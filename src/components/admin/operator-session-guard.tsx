import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useOperatorSession } from "@/lib/operator";

export function OperatorSessionGuard() {
  const router = useRouter();
  const { isOperator, isPending } = useOperatorSession();

  useEffect(() => {
    if (isPending) return;

    if (!isOperator) {
      const pathname = window.location.pathname;

      if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
        void router.navigate({
          to: "/login",
          search: { redirect: pathname },
        });
      }
    }
  }, [isOperator, isPending, router]);

  return null;
}