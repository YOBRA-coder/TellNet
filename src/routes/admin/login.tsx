import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/login")({
  component: () => <Navigate to="/login" search={{ redirect: "/admin/dashboard" }} />,
});
