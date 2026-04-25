import {
  CalendarDays,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { OrgSwitcher } from "../components/OrgSwitcher";
import { useAuthStore } from "../stores/authStore";
import { useOrgStore } from "../stores/orgStore";
import { cn } from "../utils/cn";

const navItems = [
  { to: "/events", icon: CalendarDays, label: "Événements" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
  { to: "/profile", icon: User, label: "Profil" },
];

function NavItem({
  to,
  icon: Icon,
  label,
  mobile,
  collapsed,
  onClick,
}: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
  mobile?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          "min-h-[44px]",
          mobile && "flex-col gap-1 text-xs",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-indigo-50 text-indigo-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const { myOrgs, hasFetched, fetchMyOrgs } = useOrgStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!hasFetched) {
      fetchMyOrgs().catch(() => {});
    }
  }, [fetchMyOrgs, hasFetched]);

  // Wait for the initial fetch before deciding anything
  if (!hasFetched) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-gray-400">
        Chargement…
      </div>
    );
  }

  // If user has no orgs, redirect to create/join page
  if (myOrgs.length === 0) {
    return <Navigate to="/orgs/create-or-join" replace />;
  }

  const sidebarWidth = collapsed ? "w-16" : "w-64";
  const mainMargin = collapsed ? "md:ml-16" : "md:ml-64";

  return (
    <div className="flex min-h-svh flex-col bg-gray-50 overflow-x-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 border-r border-gray-200 bg-white flex flex-col transition-all duration-200",
          "md:z-30 md:translate-x-0",
          sidebarWidth,
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full",
          "md:translate-x-0",
        )}
      >
        <div className={cn("flex h-16 items-center shrink-0", collapsed ? "justify-center px-2" : "justify-between px-6")}>
          {!collapsed && <h1 className="text-xl font-bold text-gray-900">ManyOPlan</h1>}
          {collapsed && <h1 className="text-lg font-bold text-gray-900">M</h1>}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded p-1.5 text-gray-400 hover:text-gray-600 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={cn("px-3 pb-2", collapsed && "px-2")}>
          <OrgSwitcher collapsed={collapsed} />
        </div>

        <nav className="flex-1 space-y-1 px-2 py-2">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              collapsed={collapsed}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex items-center justify-center border-t border-gray-200 py-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
          title={collapsed ? "Ouvrir la sidebar" : "Replier la sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        {!collapsed && (
          <div className="border-t border-gray-200 p-4">
            <div className="mb-3 text-sm text-gray-600">
              {user?.first_name || user?.username}
            </div>
            <button
              onClick={logout}
              className="flex w-full min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        )}
        {collapsed && (
          <div className="border-t border-gray-200 p-2">
            <button
              onClick={logout}
              title="Déconnexion"
              className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
        <h1 className="text-lg font-bold text-gray-900">ManyOPlan</h1>
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Main content */}
      <main className={cn("flex-1 pb-20 md:pb-0 transition-all duration-200", mainMargin)}>
        <div className="px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white md:hidden">
        {navItems.map((item) => (
          <div key={item.to} className="flex-1">
            <NavItem {...item} mobile />
          </div>
        ))}
      </nav>
    </div>
  );
}
