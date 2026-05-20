import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { ProfilePage } from "./features/auth/ProfilePage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { EventCreatePage } from "./features/events/EventCreatePage";
import { EventDetailPage } from "./features/events/EventDetailPage";
import { EventListPage } from "./features/events/EventListPage";
import { EventSettingsPage } from "./features/events/EventSettingsPage";
import { InvitationPage } from "./features/invitations/InvitationPage";
import { MessagesPage } from "./features/messaging/MessagesPage";
import { CreateOrgPage } from "./features/organizations/CreateOrgPage";
import { CreateOrJoinPage } from "./features/organizations/CreateOrJoinPage";
import { JoinOrgPage } from "./features/organizations/JoinOrgPage";
import { OrgSettingsPage } from "./features/organizations/OrgSettingsPage";
import { AuthLayout } from "./layouts/AuthLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { useAuthStore } from "./stores/authStore";

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <Toaster position="bottom-center" richColors />
      <Routes>
        {/* Public invitation route (accessible logged in or out) */}
        <Route path="/invite/:token" element={<InvitationPage />} />

        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Onboarding for users without an org */}
        <Route element={<ProtectedRoute />}>
          <Route path="/orgs/create-or-join" element={<CreateOrJoinPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/events" element={<EventListPage />} />
            <Route path="/events/new" element={<EventCreatePage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/events/:id/settings" element={<EventSettingsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/orgs/create" element={<CreateOrgPage />} />
            <Route path="/orgs/join" element={<JoinOrgPage />} />
            <Route path="/orgs/:id/settings" element={<OrgSettingsPage />} />
          </Route>
        </Route>

        {/* Redirect */}
        <Route path="*" element={<Navigate to="/events" replace />} />
      </Routes>
    </>
  );
}
