import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { AuthShell } from "./AuthShell";

export function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/events" replace />;
  }

  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
