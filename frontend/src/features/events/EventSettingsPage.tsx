import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, Search, Shield, ShieldOff, Trash2, UserPlus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import * as eventsApi from "../../api/events";
import { searchUsers, type UserSearchResult } from "../../api/users";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useEventStore } from "../../stores/eventStore";
import type { EventMembership } from "../../types/models";
import { cn } from "../../utils/cn";

const schema = z
  .object({
    name: z.string().min(1, "Nom requis"),
    event_type: z.enum(["festival", "conference", "sport", "charity", "other"]),
    description: z.string(),
    start_date: z.string().min(1, "Date de début requise"),
    end_date: z.string().min(1, "Date de fin requise"),
  })
  .refine((d) => new Date(d.start_date) < new Date(d.end_date), {
    message: "La date de fin doit être après la date de début",
    path: ["end_date"],
  });

type FormData = z.infer<typeof schema>;

const eventTypes = [
  { value: "festival", label: "Festival" },
  { value: "conference", label: "Conférence" },
  { value: "sport", label: "Sport" },
  { value: "charity", label: "Caritatif" },
  { value: "other", label: "Autre" },
] as const;

function toLocalDatetime(isoStr: string) {
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

// --- Member management section ---
function MemberManagement({
  eventId,
}: {
  eventId: number;
}) {
  const [members, setMembers] = useState<EventMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getMembers(eventId);
      setMembers(data.results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [eventId]);

  const handleToggleRole = async (member: EventMembership) => {
    const newRole = member.role === "admin" ? "volunteer" : "admin";
    const action = newRole === "admin" ? "Promouvoir admin" : "Rétrograder bénévole";
    if (!confirm(`${action} : ${member.full_name} ?`)) return;
    try {
      await eventsApi.updateMemberRole(eventId, member.id, newRole);
      toast.success(
        newRole === "admin"
          ? `${member.full_name} est maintenant admin`
          : `${member.full_name} est maintenant bénévole`,
      );
      fetchMembers();
    } catch {
      toast.error("Erreur");
    }
  };

  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
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
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleAddMember = async (user: UserSearchResult, role: "admin" | "volunteer") => {
    try {
      await eventsApi.addMember(eventId, user.id, role);
      toast.success(`${user.full_name} ajouté`);
      setSearchQuery("");
      setSearchResults([]);
      setShowAdd(false);
      fetchMembers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Erreur");
    }
  };

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-gray-200" />;
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4" />
          Membres & Admins
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {members.length}
          </span>
        </h3>
        {!showAdd && (
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
            <UserPlus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Add member search */}
      {showAdd && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher par nom, email, username..."
                autoFocus
                className="w-full min-h-[40px] rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button onClick={() => { setShowAdd(false); setSearchQuery(""); setSearchResults([]); }}
              className="rounded p-1.5 text-gray-400 hover:text-gray-600">
              <span className="text-xs">Annuler</span>
            </button>
          </div>
          {searching && <p className="text-xs text-gray-400">Recherche...</p>}
          {searchResults.length > 0 && (
            <ul className="space-y-1">
              {searchResults.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-gray-200">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                    <p className="text-xs text-gray-500">@{u.username} · {u.email}</p>
                  </div>
                  <div className="flex shrink-0 gap-1 ml-2">
                    <button
                      onClick={() => handleAddMember(u, "volunteer")}
                      className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 transition"
                    >
                      Bénévole
                    </button>
                    <button
                      onClick={() => handleAddMember(u, "admin")}
                      className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200 transition"
                    >
                      Admin
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400">Aucun utilisateur trouvé (ou déjà membre)</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-3 gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {m.full_name}
              </p>
              <p className="text-xs text-gray-500">@{m.username}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  m.role === "admin"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-600",
                )}
              >
                {m.role === "admin" ? "Admin" : "Bénévole"}
              </span>

              <button
                onClick={() => handleToggleRole(m)}
                className={cn(
                  "rounded p-1.5 transition min-h-[32px] min-w-[32px] flex items-center justify-center",
                  m.role === "admin"
                    ? "text-amber-500 hover:bg-amber-50"
                    : "text-indigo-500 hover:bg-indigo-50",
                )}
                title={m.role === "admin" ? "Rétrograder bénévole" : "Promouvoir admin"}
              >
                {m.role === "admin" ? (
                  <ShieldOff className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Main settings page ---
export function EventSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { currentEvent, fetchEvent, updateEvent, deleteEvent } = useEventStore();

  useEffect(() => {
    if (!currentEvent || currentEvent.id !== eventId) {
      fetchEvent(eventId);
    }
  }, [eventId, currentEvent, fetchEvent]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (currentEvent) {
      reset({
        name: currentEvent.name,
        event_type: currentEvent.event_type,
        description: currentEvent.description,
        start_date: toLocalDatetime(currentEvent.start_date),
        end_date: toLocalDatetime(currentEvent.end_date),
      });
    }
  }, [currentEvent, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      await updateEvent(eventId, {
        ...data,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
      });
      toast.success("Événement modifié");
      navigate(`/events/${eventId}`);
    } catch {
      toast.error("Erreur");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cet événement ? Cette action est irréversible.")) return;
    try {
      await deleteEvent(eventId);
      toast.success("Événement supprimé");
      navigate("/events");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  if (!currentEvent) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-200" />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to={`/events/${eventId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l'événement
      </Link>

      <h2 className="text-2xl font-bold text-gray-900">Paramètres</h2>

      {/* Event info form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
      >
        <h3 className="text-sm font-semibold text-gray-900">Informations</h3>
        <Input
          id="name"
          label="Nom de l'événement"
          error={errors.name?.message}
          {...register("name")}
        />
        <div>
          <label htmlFor="event_type" className="mb-1 block text-sm font-medium text-gray-700">
            Type
          </label>
          <select
            id="event_type"
            className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            {...register("event_type")}
          >
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            {...register("description")}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="start_date"
            label="Date de début"
            type="datetime-local"
            error={errors.start_date?.message}
            {...register("start_date")}
          />
          <Input
            id="end_date"
            label="Date de fin"
            type="datetime-local"
            error={errors.end_date?.message}
            {...register("end_date")}
          />
        </div>
        <Button type="submit" size="md" isLoading={isSubmitting}>
          <Save className="mr-1.5 h-4 w-4" />
          Enregistrer
        </Button>
      </form>

      {/* Members & Admins */}
      <MemberManagement eventId={eventId} />

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 text-sm font-semibold text-red-800">Zone de danger</h3>
        <p className="mb-4 text-xs text-red-600">
          La suppression est irréversible. Toutes les tâches, créneaux et inscriptions seront perdus.
        </p>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1.5 h-4 w-4" />
          Supprimer l'événement
        </Button>
      </div>
    </div>
  );
}
