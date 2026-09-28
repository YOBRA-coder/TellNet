import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: () => <Navigate to="/admin/dashboard" />,
});
