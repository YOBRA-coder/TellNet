import { Navigate, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { AdminShell, OWNER_ONLY_PATHS } from "@/components/admin/admin-shell";
import { useOperatorSession } from "@/lib/operator";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isOperator, isPending, isOwner } = useOperatorSession();
  const isLogin = pathname === "/admin/login";

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-10 w-40 animate-pulse rounded-md bg-raised" />
      </div>
    );
  }

  if (isLogin) {
    if (isOperator) {
      return <Navigate to="/admin/dashboard" />;
    }
    return <Outlet />;
  }

  if (!isOperator) {
    return <Navigate to="/login" search={{ redirect: pathname }} />;
  }

  if (!isOwner && OWNER_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <Navigate to="/admin/dashboard" />;
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
