import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Newspaper,
  PieChart,
  Plus,
  QrCode,
  Search,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import * as eventsApi from "../../api/events";
import { searchUsers, type UserSearchResult } from "../../api/users";
import { Button } from "../../components/ui/Button";
import { NewsPage } from "../news/NewsPage";
import { DashboardView } from "../planning/DashboardView";
import { PlanningView } from "../planning/PlanningView";
import { TableView } from "../planning/TableView";
import { TaskPanel } from "../tasks/components/TaskPanel";
import { useAssignmentStore } from "../../stores/assignmentStore";
import { useEventStore } from "../../stores/eventStore";
import { useOrgStore } from "../../stores/orgStore";
import { useTaskStore } from "../../stores/taskStore";
import type { EventInvitation } from "../../types/models";
import { cn } from "../../utils/cn";
import { InvitationQRModal } from "./InvitationQRModal";

type Tab = "table" | "planning" | "dashboard" | "tasks" | "members" | "news";

const tabs: { id: Tab; label: string; icon: typeof CalendarDays; adminOnly?: boolean }[] = [
  { id: "planning", label: "Planning", icon: CalendarDays },
  { id: "table", label: "Tableau", icon: LayoutGrid },
  { id: "tasks", label: "Tâches", icon: ClipboardList, adminOnly: true },
  { id: "dashboard", label: "Dashboard", icon: PieChart, adminOnly: true },
  { id: "members", label: "Membres", icon: Users },
  { id: "news", label: "Actualités", icon: Newspaper },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("planning");

  const { currentEvent, members, isLoading, fetchEvent, fetchMembers, joinEvent, leaveEvent, clearCurrent } =
    useEventStore();
  const { fetchTasks, clear: clearTasks } = useTaskStore();
  const { fetchAssignments, fetchMyAssignments, clear: clearAssignments } = useAssignmentStore();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const [promotedInvitations, setPromotedInvitations] = useState<EventInvitation[]>([]);
  const [qrInvitation, setQrInvitation] = useState<EventInvitation | null>(null);

  useEffect(() => {
    fetchEvent(eventId);
    fetchMembers(eventId);
    fetchTasks(eventId);
    fetchAssignments(eventId);
    fetchMyAssignments(eventId);
    return () => {
      clearCurrent();
      clearTasks();
      clearAssignments();
    };
  }, [eventId, fetchEvent, fetchMembers, fetchTasks, fetchAssignments, fetchMyAssignments, clearCurrent, clearTasks, clearAssignments]);

  const isOrgAdmin =
    !!currentEvent &&
    currentOrg?.id === currentEvent.organization &&
    currentOrg?.my_role === "admin";
  const isAdmin =
    !!currentEvent && (currentEvent.my_role === "admin" || isOrgAdmin);
  const isMember =
    !!currentEvent && (currentEvent.my_role !== null || isOrgAdmin);

  useEffect(() => {
    if (!isMember) {
      setPromotedInvitations([]);
      return;
    }
    let cancelled = false;
    eventsApi
      .getPromotedEventInvitations(eventId)
      .then((data) => {
        if (!cancelled) setPromotedInvitations(data);
      })
      .catch(() => {
        if (!cancelled) setPromotedInvitations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, isMember]);

  if (isLoading && !currentEvent) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded-xl bg-gray-200" />
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="text-center text-gray-600">Événement introuvable.</div>
    );
  }

  const handleJoin = async () => {
    try {
      await joinEvent(eventId);
      toast.success("Vous avez rejoint l'événement !");
      fetchMembers(eventId);
    } catch {
      toast.error("Impossible de rejoindre l'événement");
    }
  };

  const handleLeave = async () => {
    if (!confirm("Quitter cet événement ?")) return;
    try {
      await leaveEvent(eventId);
      await fetchEvent(eventId);
      fetchMembers(eventId);
      toast.success("Vous avez quitté l'événement");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Erreur");
    }
  };

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div>
      {/* Header */}
      <Link
        to="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Événements
      </Link>

      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-gray-900">
              {currentEvent.name}
            </h2>
            {currentEvent.description && (
              <p className="mt-1 text-sm text-gray-600">
                {currentEvent.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                {formatDate(currentEvent.start_date)}
              </span>
              <span>→</span>
              <span>{formatDate(currentEvent.end_date)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              {currentEvent.member_count} membre
              {currentEvent.member_count > 1 ? "s" : ""}
              <span className="text-gray-400">·</span>
              <span>{currentEvent.organization_name}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end justify-between gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!isMember && (
                <Button onClick={handleJoin} size="md">
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Rejoindre
                </Button>
              )}
              {isMember && !isAdmin && (
                <Button onClick={handleLeave} variant="ghost" size="sm">
                  <LogOut className="mr-1.5 h-4 w-4" />
                  Quitter
                </Button>
              )}
              {isAdmin && (
                <Button variant="secondary" size="sm" onClick={() => navigate(`/events/${eventId}/settings`)}>
                  <Settings className="mr-1.5 h-4 w-4" />
                  Paramètres
                </Button>
              )}
            </div>
            {isMember && promotedInvitations.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {promotedInvitations.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setQrInvitation(inv)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    title={`Partager : ${inv.label || "lien d'invitation"}`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    {inv.label ? `QR · ${inv.label}` : "QR"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 -mx-4 overflow-x-auto px-4">
        <div className="flex gap-1 border-b border-gray-200">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                "min-h-[44px]",
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
        {activeTab === "table" && (
          <TableView eventId={eventId} isAdmin={isAdmin} />
        )}
        {activeTab === "planning" && (
          <PlanningView eventId={eventId} isAdmin={isAdmin} />
        )}
        {activeTab === "tasks" && (
          <TaskPanel eventId={eventId} isAdmin={isAdmin} eventStartDate={currentEvent.start_date} eventEndDate={currentEvent.end_date} />
        )}
        {activeTab === "dashboard" && (
          <DashboardView eventId={eventId} />
        )}
        {activeTab === "members" && (
          <MembersList members={members} isAdmin={isAdmin} eventId={eventId} onMembersChanged={() => fetchMembers(eventId)} />
        )}
        {activeTab === "news" && (
          <NewsPage eventId={eventId} isAdmin={isAdmin} />
        )}
      </div>

      {qrInvitation && (
        <InvitationQRModal
          invitation={qrInvitation}
          onClose={() => setQrInvitation(null)}
        />
      )}
    </div>
  );
}

function MembersList({
  members,
  isAdmin,
  eventId,
  onMembersChanged,
}: {
  members: { id: number; user: number; username: string; full_name: string; role: string }[];
  isAdmin: boolean;
  eventId: number;
  onMembersChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const memberUserIds = new Set(members.map((m) => m.user));

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchUsers(q);
        setSearchResults(results.filter((u) => !memberUserIds.has(u.id)));
      } finally { setSearching(false); }
    }, 300);
  };

  const handleAdd = async (user: UserSearchResult, role: "admin" | "volunteer") => {
    try {
      await eventsApi.addMember(eventId, user.id, role);
      toast.success(`${user.full_name} ajouté`);
      setSearchQuery("");
      setSearchResults([]);
      setShowAdd(false);
      onMembersChanged();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Erreur");
    }
  };

  return (
    <div>
      {/* Header */}
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          {!showAdd ? (
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter un membre
            </Button>
          ) : (
            <div className="w-full rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Rechercher par nom, email..."
                    autoFocus
                    className="w-full min-h-[40px] rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <button onClick={() => { setShowAdd(false); setSearchQuery(""); setSearchResults([]); }}
                  className="text-xs text-gray-500 hover:text-gray-700">Annuler</button>
              </div>
              {searching && <p className="text-xs text-gray-400">Recherche...</p>}
              {searchResults.length > 0 && (
                <ul className="space-y-1">
                  {searchResults.map((u) => (
                    <li key={u.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-gray-200">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                        <p className="text-xs text-gray-500">@{u.username}</p>
                      </div>
                      <div className="flex shrink-0 gap-1 ml-2">
                        <button onClick={() => handleAdd(u, "volunteer")}
                          className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200">
                          Bénévole
                        </button>
                        <button onClick={() => handleAdd(u, "admin")}
                          className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200">
                          Admin
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-xs text-gray-400">Aucun utilisateur trouvé</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <p className="py-8 text-center text-gray-500">Aucun membre.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.full_name}</p>
                <p className="text-xs text-gray-500">@{m.username}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  m.role === "admin"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                {m.role === "admin" ? "Admin" : "Bénévole"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
