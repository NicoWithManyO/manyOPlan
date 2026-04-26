import * as Popover from "@radix-ui/react-popover";
import { ArrowRightLeft, ChevronLeft, ChevronRight, LogOut, Maximize2, Minimize2, Printer, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { quickCreateVolunteer, searchUsers, type UserSearchResult } from "../../api/users";
import { useAssignmentStore } from "../../stores/assignmentStore";
import { useAuthStore } from "../../stores/authStore";
import { useTaskStore } from "../../stores/taskStore";
import type { Assignment, Slot, Task } from "../../types/models";
import { cn } from "../../utils/cn";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayHeader(date: Date) {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function formatHour(hour: number) {
  return `${(hour % 24).toString().padStart(2, "0")}:00`;
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toTimeInput(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function buildDateTime(slotDateStr: string, time: string) {
  const d = new Date(slotDateStr);
  const slotStartHour = d.getHours();
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  // Si l'heure est avant le début du slot, c'est le lendemain (créneau passant minuit)
  if (h < slotStartHour) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString();
}

function getEventDays(tasks: Task[]): Date[] {
  const daySet = new Set<string>();
  for (const task of tasks) {
    for (const slot of task.slots) {
      const d = new Date(slot.start_date);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  return Array.from(daySet)
    .map((key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m, d); })
    .sort((a, b) => a.getTime() - b.getTime());
}

function getDayHourRange(tasks: Task[], day: Date): [number, number] {
  let minH = 24, maxH = 0;
  for (const task of tasks) {
    for (const slot of task.slots) {
      const s = new Date(slot.start_date), e = new Date(slot.end_date);
      if (isSameDay(s, day)) {
        minH = Math.min(minH, s.getHours());
        let endH: number;
        if (isSameDay(s, e)) {
          endH = e.getHours() + (e.getMinutes() > 0 ? 1 : 0);
        } else {
          // Slot crosses midnight — extend to 24 + end hour (e.g. 01:00 → 25)
          endH = 24 + e.getHours() + (e.getMinutes() > 0 ? 1 : 0);
        }
        maxH = Math.max(maxH, endH);
      }
    }
  }
  return [minH, maxH];
}

// --- Overlap layout algorithm (like Google Calendar) ---
interface LayoutInfo {
  assignment: Assignment;
  col: number;
  totalCols: number;
}

function computeOverlapLayout(assignments: Assignment[]): LayoutInfo[] {
  if (assignments.length === 0) return [];

  const sorted = [...assignments].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  // Group overlapping assignments
  const groups: Assignment[][] = [];
  let currentGroup: Assignment[] = [sorted[0]];
  let groupEnd = new Date(sorted[0].end_date).getTime();

  for (let i = 1; i < sorted.length; i++) {
    const aStart = new Date(sorted[i].start_date).getTime();
    if (aStart < groupEnd) {
      currentGroup.push(sorted[i]);
      groupEnd = Math.max(groupEnd, new Date(sorted[i].end_date).getTime());
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      groupEnd = new Date(sorted[i].end_date).getTime();
    }
  }
  groups.push(currentGroup);

  // Assign columns within each group
  const result: LayoutInfo[] = [];
  for (const group of groups) {
    const columns: Assignment[][] = [];
    for (const a of group) {
      const aStart = new Date(a.start_date).getTime();
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        if (new Date(lastInCol.end_date).getTime() <= aStart) {
          columns[c].push(a);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([a]);
      }
    }
    const totalCols = columns.length;
    for (let c = 0; c < columns.length; c++) {
      for (const a of columns[c]) {
        result.push({ assignment: a, col: c, totalCols });
      }
    }
  }
  return result;
}

const PX_PER_HOUR = 80;

// --- Admin: add user to slot ---
function AddUserToSlot({
  slot, eventId, onDone,
}: {
  slot: Slot; eventId: number; onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startTime, setStartTime] = useState(toTimeInput(slot.start_date));
  const [endTime, setEndTime] = useState(toTimeInput(slot.end_date));
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (timeout.current) clearTimeout(timeout.current);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    timeout.current = setTimeout(async () => {
      try {
        const r = await searchUsers(q);
        setResults(r);
      } finally { setSearching(false); }
    }, 300);
  };

  const handleAdd = async (user: UserSearchResult) => {
    const s = buildDateTime(slot.start_date, startTime);
    const en = buildDateTime(slot.start_date, endTime);
    if (s >= en) { toast.error("La fin doit être après le début"); return; }
    setBusy(true);
    try {
      await import("../../api/assignments").then((api) =>
        api.createAssignment(eventId, slot.id, s, en, user.id, true),
      );
      toast.success(`${user.full_name} ajouté`);
      onDone();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
          className="min-h-[32px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
        <span className="text-xs text-gray-400">→</span>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
          className="min-h-[32px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="text" value={query} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher un membre..."
          autoFocus
          className="w-full min-h-[36px] rounded-lg border border-gray-300 pl-7 pr-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
        />
      </div>
      {searching && <p className="text-[10px] text-gray-400">Recherche...</p>}
      {results.map((u) => (
        <button key={u.id} onClick={() => handleAdd(u)} disabled={busy}
          className="flex w-full items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-left text-xs hover:bg-indigo-50 transition">
          <UserPlus className="h-3 w-3 text-indigo-500 shrink-0" />
          <span className="truncate font-medium text-gray-800">{u.full_name}</span>
          <span className="truncate text-gray-400">@{u.username}</span>
        </button>
      ))}
      {query.length >= 2 && !searching && results.length === 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-400">Aucun résultat</p>
          <button onClick={async () => {
            const parts = query.trim().split(/\s+/);
            const firstName = parts[0] || query.trim();
            const lastName = parts.slice(1).join(" ");
            setBusy(true);
            try {
              const newUser = await quickCreateVolunteer(firstName, lastName);
              await handleAdd({ id: newUser.id, full_name: newUser.full_name, username: newUser.username, email: "" });
            } catch (err: unknown) {
              const error = err as { response?: { data?: { detail?: string } } };
              toast.error(error.response?.data?.detail ?? "Erreur");
              setBusy(false);
            }
          }} disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-2 py-1.5 text-left text-xs text-indigo-700 hover:bg-indigo-100 transition">
            <UserPlus className="h-3 w-3 text-indigo-500 shrink-0" />
            <span className="font-medium">Créer « {query.trim()} » et affecter</span>
          </button>
        </div>
      )}
    </div>
  );
}

// --- Admin: edit assignment popover ---
function EditAssignmentPopover({
  assignment, slot, eventId, onClose,
}: {
  assignment: Assignment; slot: Slot; eventId: number; onClose: () => void;
}) {
  const { updateTimes, fetchAssignments } = useAssignmentStore();
  const [startTime, setStartTime] = useState(toTimeInput(assignment.start_date));
  const [endTime, setEndTime] = useState(toTimeInput(assignment.end_date));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const changed = startTime !== toTimeInput(assignment.start_date) || endTime !== toTimeInput(assignment.end_date);

  const handleSave = async () => {
    setError("");
    const s = buildDateTime(slot.start_date, startTime);
    const en = buildDateTime(slot.start_date, endTime);
    if (s >= en) { setError("La fin doit être après le début"); return; }
    setBusy(true);
    try {
      await updateTimes(eventId, assignment.id, s, en);
      toast.success("Heures modifiées");
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      setError(apiErr.response?.data?.detail ?? "Erreur");
    } finally { setBusy(false); }
  };

  const handleRemove = async () => {
    if (!confirm(`Retirer ${assignment.full_name} de ce créneau ?`)) return;
    setBusy(true);
    try {
      await import("../../api/assignments").then((api) => api.deleteAssignment(eventId, assignment.id));
      await fetchAssignments(eventId);
      toast.success(`${assignment.full_name} retiré`);
      onClose();
    } catch { toast.error("Erreur"); }
    finally { setBusy(false); }
  };

  return (
    <div className="w-[240px] space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-900 truncate">{assignment.full_name}</p>
        <Popover.Close className="cursor-pointer text-gray-400 hover:text-gray-600">
          <X style={{width:"14px",height:"14px"}} />
        </Popover.Close>
      </div>
      <div className="flex items-center gap-2">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
          className="min-h-[32px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
        <span className="text-xs text-gray-400">→</span>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
          className="min-h-[32px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        {changed && (
          <Button size="sm" className="flex-1" isLoading={busy} onClick={handleSave}>
            Enregistrer
          </Button>
        )}
        <Button variant="secondary" size="sm" className={changed ? "" : "flex-1"} isLoading={busy} onClick={handleRemove}>
          <Trash2 className="mr-1 h-3 w-3" />Retirer
        </Button>
      </div>
    </div>
  );
}

// --- Editable row for one of my plages on a slot ---
function MyPlageRow({
  assignment, slot, eventId, onDone,
}: {
  assignment: Assignment; slot: Slot; eventId: number; onDone: () => void;
}) {
  const { unregister, updateTimes } = useAssignmentStore();
  const [startTime, setStartTime] = useState(toTimeInput(assignment.start_date));
  const [endTime, setEndTime] = useState(toTimeInput(assignment.end_date));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dirty =
    startTime !== toTimeInput(assignment.start_date) ||
    endTime !== toTimeInput(assignment.end_date);

  const handleUpdate = async () => {
    setError("");
    const s = buildDateTime(slot.start_date, startTime);
    const en = buildDateTime(slot.start_date, endTime);
    if (s >= en) { setError("La fin doit être après le début"); return; }
    setBusy(true);
    try {
      await updateTimes(eventId, assignment.id, s, en);
      toast.success("Heures modifiées");
      onDone();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      setError(apiErr.response?.data?.detail ?? "Erreur");
    } finally { setBusy(false); }
  };

  const handleUnregister = async () => {
    if (!confirm("Se désinscrire de cette plage ?")) return;
    setBusy(true);
    try {
      await unregister(eventId, assignment.id);
      toast.success("Désinscrit");
      onDone();
    } catch {
      toast.error("Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
      <div className="flex items-center gap-1.5">
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
          min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
          className="min-h-[32px] flex-1 rounded-md border border-gray-300 px-1.5 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
        <span className="text-xs text-gray-400">→</span>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
          min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
          className="min-h-[32px] flex-1 rounded-md border border-gray-300 px-1.5 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
        {assignment.status === "backup" && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">sec.</span>
        )}
        <button
          type="button"
          onClick={handleUnregister}
          disabled={busy}
          title="Se désinscrire de cette plage"
          className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {dirty && (
        <Button size="sm" className="mt-2 w-full" isLoading={busy} onClick={handleUpdate}>
          Modifier mes heures
        </Button>
      )}
    </div>
  );
}

// --- Popover for registration ---
function SlotPopoverContent({
  slot, task, eventId, onClose,
}: {
  slot: Slot; task: Task; eventId: number; onClose: () => void;
}) {
  const { register: registerSlot, assignments } = useAssignmentStore();
  const userId = useAuthStore((s) => s.user?.id);
  const byStart = (a: Assignment, b: Assignment) =>
    a.start_date.localeCompare(b.start_date);
  const slotAssignments = assignments
    .filter((a) => a.slot === slot.id)
    .slice()
    .sort(byStart);
  const myAssignments = slotAssignments.filter((a) => a.user === userId);
  const otherAssignments = slotAssignments.filter((a) => a.user !== userId);

  const [startTime, setStartTime] = useState(toTimeInput(slot.start_date));
  const [endTime, setEndTime] = useState(toTimeInput(slot.end_date));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const s = buildDateTime(slot.start_date, startTime);
    const en = buildDateTime(slot.start_date, endTime);
    if (s >= en) { setError("La fin doit être après le début"); return; }
    setBusy(true);
    try {
      const r = await registerSlot(eventId, slot.id, s, en);
      toast.success(r.status === "backup" ? "Inscrit en secours" : "Inscrit !");
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      setError(apiErr.response?.data?.detail ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="w-[300px]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{task.name}</h4>
          <p className="text-xs text-gray-500">{fmt(slot.start_date)} - {fmt(slot.end_date)}</p>
        </div>
        <span onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 cursor-pointer">
          <X className="h-4 w-4" />
        </span>
      </div>

      {/* Autres inscrits sur ce créneau */}
      {otherAssignments.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-[10px] font-medium text-gray-500 uppercase">Inscrits</p>
          {otherAssignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs">
              <span className={cn("truncate", a.is_placeholder ? "italic text-gray-400" : "text-gray-700")}>
                {a.full_name}{a.is_placeholder ? " *" : ""}
              </span>
              <span className="shrink-0 text-gray-400 ml-1">{fmt(a.start_date)}-{fmt(a.end_date)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mes plages sur ce créneau */}
      {myAssignments.length > 0 && (
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-600">
            {myAssignments.length === 1 ? "Mon inscription" : `Mes inscriptions (${myAssignments.length})`}
          </p>
          {myAssignments.map((mine) => (
            <MyPlageRow
              key={mine.id}
              assignment={mine}
              slot={slot}
              eventId={eventId}
              onDone={onClose}
            />
          ))}
        </div>
      )}

      {/* Form: nouvelle inscription / plage supplémentaire */}
      <form onSubmit={handleRegister} className="mt-3 space-y-2 border-t border-gray-200 pt-3">
        <p className="text-xs text-gray-600">
          {myAssignments.length === 0 ? "M'inscrire :" : "Ajouter une plage :"}
        </p>
        <div className="flex items-center gap-2">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
            min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
            className="min-h-[32px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
          <span className="text-xs text-gray-400">→</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
            min={toTimeInput(slot.start_date)} max={toTimeInput(slot.end_date)}
            className="min-h-[32px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" size="sm" className="w-full" isLoading={busy}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />S'inscrire
        </Button>
      </form>
    </div>
  );
}

// --- Timeline slot ---
function TimelineSlot({
  slot, task, startHour, slotAssignments, userId, eventId, isAdmin,
}: {
  slot: Slot; task: Task; startHour: number;
  slotAssignments: Assignment[]; userId: number | undefined; eventId: number; isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const slotStart = new Date(slot.start_date);
  const slotEnd = new Date(slot.end_date);
  const topOffset = (slotStart.getHours() + slotStart.getMinutes() / 60 - startHour) * PX_PER_HOUR;
  const slotHeight = ((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60 * 60)) * PX_PER_HOUR;
  const slotDurationMs = slotEnd.getTime() - slotStart.getTime();
  const hasMine = slotAssignments.some((a) => a.user === userId);

  const layout = computeOverlapLayout(slotAssignments);

  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (v) setEditingId(null); }}>
      <Popover.Trigger asChild>
        {/* Slot card */}
        <div
          className={cn(
            "group absolute left-0 right-0 mx-0.5 rounded-md border bg-white cursor-pointer transition-all",
            open ? "border-indigo-500 ring-2 ring-indigo-500/30 shadow-md z-10"
              : hasMine ? "border-indigo-300 hover:shadow-sm"
              : "border-gray-300 hover:shadow-sm hover:border-gray-400",
          )}
          style={{ top: `${topOffset}px`, height: `${slotHeight}px` }}
        >
          {/* Hour grid lines inside slot */}
          <div className="relative h-full">
            {(() => {
              const lines: React.ReactNode[] = [];
              const firstHour = Math.ceil(slotStart.getHours() + slotStart.getMinutes() / 60);
              const durationH = slotDurationMs / (1000 * 60 * 60);
              for (let h = firstHour; h < slotStart.getHours() + slotStart.getMinutes() / 60 + durationH; h++) {
                const offsetH = h - (slotStart.getHours() + slotStart.getMinutes() / 60);
                const pct = (offsetH / durationH) * 100;
                if (pct > 0 && pct < 100) {
                  lines.push(<div key={h} className="absolute left-0 right-0 border-t border-gray-200/60 z-10 pointer-events-none" style={{ top: `${pct}%` }} />);
                }
              }
              return lines;
            })()}

            {/* Volunteer bars */}
            {layout.map(({ assignment: a, col, totalCols }) => {
              const aStart = new Date(a.start_date);
              const aEnd = new Date(a.end_date);
              const topPct = ((aStart.getTime() - slotStart.getTime()) / slotDurationMs) * 100;
              const heightPct = ((aEnd.getTime() - aStart.getTime()) / slotDurationMs) * 100;
              const leftPct = (col / totalCols) * 100;
              const widthPct = (1 / totalCols) * 100;
              const isMine = a.user === userId;
              const isBackup = a.status === "backup";
              const placeholder = a.is_placeholder;

              const barEl = (
                <div
                  className={cn(
                    "absolute rounded-sm border-l-[3px] overflow-hidden flex flex-row gap-1 px-1 py-0.5",
                    placeholder
                      ? "border-l-gray-400 bg-gray-100/90"
                      : isMine
                        ? "border-l-indigo-600 bg-indigo-100/90"
                        : isBackup
                          ? "border-l-amber-400 bg-amber-50/90"
                          : "border-l-emerald-500 bg-emerald-50/90",
                    isAdmin && "cursor-pointer hover:ring-1 hover:ring-indigo-400/50",
                  )}
                  style={{
                    top: `${topPct}%`,
                    height: `${Math.max(heightPct, 3)}%`,
                    left: `${leftPct}%`,
                    width: `${widthPct - 1}%`,
                    minHeight: "20px",
                  }}
                  title={`${a.full_name}${placeholder ? " (non inscrit)" : ""}: ${fmt(a.start_date)} - ${fmt(a.end_date)}`}
                >
                  <p className={cn(
                    "text-[10px] leading-none [writing-mode:vertical-rl] [text-orientation:upright] truncate shrink-0",
                    placeholder ? "italic text-gray-500"
                      : isMine ? "font-bold text-indigo-900"
                      : "font-medium text-gray-700",
                  )}>
                    {a.full_name}{placeholder ? " *" : ""}
                  </p>
                  {totalCols < 3 && (
                    <div className="text-[8px] text-gray-400 leading-tight shrink-0">
                      <p>{fmt(a.start_date)}</p>
                      <p>{fmt(a.end_date)}</p>
                    </div>
                  )}
                </div>
              );

              if (!isAdmin) return <span key={a.id}>{barEl}</span>;

              return (
                <Popover.Root key={a.id} open={editingId === a.id} onOpenChange={(v) => { setEditingId(v ? a.id : null); if (v) setOpen(false); }}>
                  <Popover.Trigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    {barEl}
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      side="bottom"
                      sideOffset={4}
                      align="start"
                      collisionPadding={16}
                      className="z-[70] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <EditAssignmentPopover assignment={a} slot={slot} eventId={eventId} onClose={() => setEditingId(null)} />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              );
            })}

            {slotAssignments.length === 0 && slotHeight >= 30 && (
              <div className="flex h-full items-center justify-center text-[10px] text-gray-300 italic">
                Cliquez pour s'inscrire
              </div>
            )}
          </div>
        </div>
      </Popover.Trigger>

      {/* Registration popover — via Radix Portal */}
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          sideOffset={4}
          align="start"
          collisionPadding={16}
          className="z-50 max-h-[85vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SlotPopoverContent slot={slot} task={task} eventId={eventId} onClose={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const TASK_COL_MIN_WIDTH = 120;

function TaskHeader({
  task, times, slots, assignments, isAdmin, eventId,
}: {
  task: Task; times: string[]; slots: Slot[];
  assignments: Assignment[]; isAdmin: boolean; eventId: number;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(slots.length === 1 ? slots[0] : null);
  const { fetchAssignments } = useAssignmentStore();
  const confirmed = assignments.filter((a) => a.status === "confirmed").length;
  const minV = task.min_volunteers;
  const totalCapacity = slots.reduce((sum, s) => sum + (s.capacity ?? 0), 0);
  const hasCapacity = slots.some((s) => s.capacity !== null);
  const isFull = hasCapacity && confirmed >= totalCapacity;
  const underMin = minV !== null && confirmed < minV;

  return (
    <div
      className="relative flex-1 rounded-md bg-indigo-100 px-2 py-1.5 text-center"
      style={{ minWidth: `${TASK_COL_MIN_WIDTH}px` }}
    >
      <p className="text-xs font-semibold text-indigo-800 truncate">{task.name}</p>
      <p className="text-[10px] text-indigo-600/70">{times.join(" · ")}</p>
      <div className="flex items-center justify-center gap-1.5 mt-0.5">
        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", underMin ? "text-amber-600" : minV !== null && confirmed >= minV ? "text-emerald-600" : "text-indigo-700")}>
          <Users className="h-3 w-3" />
          {confirmed}{minV !== null ? `/${minV}` : hasCapacity ? `/${totalCapacity}` : ""}
          {isFull && <span className="text-amber-600">!</span>}
        </span>
        {isAdmin && (
          <Popover.Root open={showAssign} onOpenChange={(v) => { setShowAssign(v); if (!v) setSelectedSlot(slots.length === 1 ? slots[0] : null); }}>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label="Affecter un membre"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[11px] leading-none hover:bg-indigo-700 transition"
              >+</button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                sideOffset={4}
                align="center"
                collisionPadding={16}
                className="z-[60] w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-900">{task.name} — Affecter</p>
                  <Popover.Close className="cursor-pointer text-gray-400 hover:text-gray-600">
                    <X style={{width:"14px",height:"14px"}} />
                  </Popover.Close>
                </div>
                {slots.length > 1 && !selectedSlot && (
                  <div className="space-y-1 mb-2">
                    <p className="text-[10px] text-gray-500">Choisir le créneau :</p>
                    {slots.map((s) => (
                      <button key={s.id} onClick={() => setSelectedSlot(s)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-left text-xs hover:bg-indigo-50 transition">
                        {fmt(s.start_date)} - {fmt(s.end_date)}
                      </button>
                    ))}
                  </div>
                )}
                {selectedSlot && (
                  <>
                    {slots.length > 1 && (
                      <button onClick={() => setSelectedSlot(null)}
                        className="mb-2 text-[10px] text-indigo-600 hover:underline">
                        ← Autre créneau
                      </button>
                    )}
                    <AddUserToSlot slot={selectedSlot} eventId={eventId} onDone={() => { fetchAssignments(eventId); setShowAssign(false); }} />
                  </>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>
    </div>
  );
}

// --- Transposed slot (horizontal bar with positioned assignments) ---
const ROW_HEIGHT = 48;
const TASK_LABEL_WIDTH = 160;

function TransposedSlot({
  slot, task, left, width, slotAssignments, userId, eventId, isAdmin,
}: {
  slot: Slot; task: Task; left: number; width: number;
  slotAssignments: Assignment[]; userId: number | undefined; eventId: number; isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const myAssignment = slotAssignments.find((a) => a.user === userId);
  const slotStart = new Date(slot.start_date);
  const slotDurationMs = new Date(slot.end_date).getTime() - slotStart.getTime();

  // Compute horizontal overlap layout (rows instead of cols)
  const layout = computeOverlapLayout(slotAssignments);

  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (v) setEditingId(null); }}>
      <Popover.Trigger asChild>
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 rounded border cursor-pointer transition-all overflow-hidden",
            open ? "border-indigo-500 ring-2 ring-indigo-500/30 shadow-md z-10 bg-white"
              : myAssignment ? "border-indigo-300 bg-indigo-50/50 hover:shadow-sm"
              : "border-gray-200 bg-gray-50/50 hover:shadow-sm hover:border-gray-300",
          )}
          style={{ left: `${left}px`, width: `${width}px` }}
        >
          <div className="relative h-full">
            {layout.map(({ assignment: a, col, totalCols }) => {
              const aStart = new Date(a.start_date);
              const aEnd = new Date(a.end_date);
              const leftPct = ((aStart.getTime() - slotStart.getTime()) / slotDurationMs) * 100;
              const widthPct = ((aEnd.getTime() - aStart.getTime()) / slotDurationMs) * 100;
              const topPct = (col / totalCols) * 100;
              const heightPct = (1 / totalCols) * 100;
              const isMine = a.user === userId;
              const isBackup = a.status === "backup";
              const placeholder = a.is_placeholder;

              const barEl = (
                <div
                  className={cn(
                    "absolute rounded-sm border-l-[3px] px-1 overflow-hidden flex items-center",
                    placeholder ? "border-l-gray-400 bg-gray-100/90"
                      : isMine ? "border-l-indigo-600 bg-indigo-100/90"
                      : isBackup ? "border-l-amber-400 bg-amber-50/90"
                      : "border-l-emerald-500 bg-emerald-50/90",
                    isAdmin && "cursor-pointer hover:ring-1 hover:ring-indigo-400/50",
                  )}
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 3)}%`,
                    top: `${topPct}%`,
                    height: `${heightPct - 2}%`,
                    minWidth: "30px",
                  }}
                  title={`${a.full_name}${placeholder ? " (non inscrit)" : ""}: ${fmt(a.start_date)} - ${fmt(a.end_date)}`}
                >
                  <p className={cn(
                    "text-[9px] leading-tight truncate",
                    placeholder ? "italic text-gray-500"
                      : isMine ? "font-bold text-indigo-900"
                      : "font-medium text-gray-700",
                  )}>
                    {a.full_name}{placeholder ? " *" : ""}
                  </p>
                </div>
              );

              if (!isAdmin) return <span key={a.id}>{barEl}</span>;

              return (
                <Popover.Root key={a.id} open={editingId === a.id} onOpenChange={(v) => { setEditingId(v ? a.id : null); if (v) setOpen(false); }}>
                  <Popover.Trigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    {barEl}
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content side="bottom" sideOffset={4} align="start" collisionPadding={16}
                      className="z-[70] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
                      onClick={(e) => e.stopPropagation()} onOpenAutoFocus={(e) => e.preventDefault()}>
                      <EditAssignmentPopover assignment={a} slot={slot} eventId={eventId} onClose={() => setEditingId(null)} />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              );
            })}
            {slotAssignments.length === 0 && (
              <div className="flex h-full items-center justify-center text-[10px] text-gray-300 italic">Vide</div>
            )}
          </div>
        </div>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" sideOffset={4} align="start" collisionPadding={16}
          className="z-50 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}>
          <SlotPopoverContent slot={slot} task={task} eventId={eventId} onClose={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// --- Transposed day column (tasks = rows, hours = columns) ---
function TransposedDayColumn({
  day, tasks, assignments, userId, eventId, isAdmin,
}: {
  day: Date; tasks: Task[]; assignments: Assignment[]; userId: number | undefined; eventId: number; isAdmin: boolean;
}) {
  const [startHour, endHour] = getDayHourRange(tasks, day);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const totalWidth = (endHour - startHour) * PX_PER_HOUR;

  const daySlots: { task: Task; slot: Slot }[] = [];
  for (const task of tasks)
    for (const slot of task.slots)
      if (isSameDay(new Date(slot.start_date), day))
        daySlots.push({ task, slot });

  const taskIds = [...new Set(daySlots.map((ds) => ds.task.id))];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const { fetchAssignments } = useAssignmentStore();

  return (
    <div className="w-full">
      {/* Hours header — sticky */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="flex">
          <div className="shrink-0 border-r border-gray-200" style={{ width: `${TASK_LABEL_WIDTH}px` }} />
          <div className="relative" style={{ width: `${totalWidth}px`, height: "24px" }}>
            {hours.map((h) => (
              <span key={h} className="absolute text-[10px] font-medium text-gray-500"
                style={{ left: `${(h - startHour) * PX_PER_HOUR}px`, top: "50%", transform: "translate(-50%, -50%)" }}>
                {formatHour(h)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Task rows */}
      {taskIds.map((taskId) => {
        const task = taskMap.get(taskId)!;
        const taskSlots = daySlots.filter((ds) => ds.task.id === taskId);
        const taskAssignments = assignments.filter((a) => taskSlots.some((ts) => ts.slot.id === a.slot));
        const confirmed = taskAssignments.filter((a) => a.status === "confirmed").length;
        const minV = task.min_volunteers;
        const totalCapacity = taskSlots.reduce((sum, ts) => sum + (ts.slot.capacity ?? 0), 0);
        const hasCapacity = taskSlots.some((ts) => ts.slot.capacity !== null);
        const underMin = minV !== null && confirmed < minV;

        return (
          <div key={taskId} className="flex border-b border-gray-100">
            {/* Task label */}
            <div className="shrink-0 flex flex-col justify-center px-3 border-r border-gray-200 bg-gray-50/50"
              style={{ width: `${TASK_LABEL_WIDTH}px`, height: `${ROW_HEIGHT}px` }}>
              <p className="text-xs font-semibold text-indigo-800 truncate text-right">{task.name}</p>
              <div className="flex items-center justify-end gap-1.5">
                <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", underMin ? "text-amber-600" : minV !== null && confirmed >= minV ? "text-emerald-600" : "text-indigo-700")}>
                  <Users className="h-3 w-3" />
                  {confirmed}{minV !== null ? `/${minV}` : hasCapacity ? `/${totalCapacity}` : ""}
                </span>
                {isAdmin && (
                  <Popover.Root>
                    <Popover.Trigger asChild>
                      <button type="button" aria-label="Affecter un membre"
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[11px] leading-none hover:bg-indigo-700">
                        +
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content side="right" sideOffset={4} align="start" collisionPadding={16}
                        className="z-[60] w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
                        onOpenAutoFocus={(e) => e.preventDefault()}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-900">{task.name} — Affecter</p>
                          <Popover.Close className="cursor-pointer text-gray-400 hover:text-gray-600">
                            <X style={{width:"14px",height:"14px"}} />
                          </Popover.Close>
                        </div>
                        {taskSlots.length === 1 ? (
                          <AddUserToSlot slot={taskSlots[0].slot} eventId={eventId} onDone={() => fetchAssignments(eventId)} />
                        ) : (
                          <TransposedSlotPicker taskSlots={taskSlots} eventId={eventId} fetchAssignments={fetchAssignments} />
                        )}
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}
              </div>
            </div>

            {/* Slots area with grid */}
            <div className="relative" style={{ height: `${ROW_HEIGHT}px`, width: `${totalWidth}px` }}>
              {/* Vertical grid lines */}
              {hours.map((h) => (
                <div key={h} className="absolute top-0 bottom-0 border-l border-gray-100"
                  style={{ left: `${(h - startHour) * PX_PER_HOUR}px` }} />
              ))}
              {/* Slot bars */}
              {taskSlots.map(({ slot }) => {
                const slotStart = new Date(slot.start_date);
                const slotEnd = new Date(slot.end_date);
                const left = (slotStart.getHours() + slotStart.getMinutes() / 60 - startHour) * PX_PER_HOUR;
                const width = ((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60 * 60)) * PX_PER_HOUR;
                const slotAssignments = assignments.filter((a) => a.slot === slot.id);
                return (
                  <TransposedSlot key={slot.id} slot={slot} task={task}
                    left={left} width={width} slotAssignments={slotAssignments}
                    userId={userId} eventId={eventId} isAdmin={isAdmin} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransposedSlotPicker({
  taskSlots, eventId, fetchAssignments,
}: {
  taskSlots: { task: Task; slot: Slot }[]; eventId: number;
  fetchAssignments: (eventId: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Slot | null>(null);
  if (selected) {
    return (
      <>
        <button onClick={() => setSelected(null)} className="mb-2 text-[10px] text-indigo-600 hover:underline">
          ← Autre créneau
        </button>
        <AddUserToSlot slot={selected} eventId={eventId} onDone={() => fetchAssignments(eventId)} />
      </>
    );
  }
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-gray-500">Choisir le créneau :</p>
      {taskSlots.map(({ slot }) => (
        <button key={slot.id} onClick={() => setSelected(slot)}
          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-left text-xs hover:bg-indigo-50 transition">
          {fmt(slot.start_date)} - {fmt(slot.end_date)}
        </button>
      ))}
    </div>
  );
}

function DayColumn({
  day, tasks, assignments, userId, eventId, isAdmin,
}: {
  day: Date; tasks: Task[]; assignments: Assignment[]; userId: number | undefined; eventId: number; isAdmin: boolean;
}) {
  const [startHour, endHour] = getDayHourRange(tasks, day);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalHeight = hours.length * PX_PER_HOUR;

  const daySlots: { task: Task; slot: Slot }[] = [];
  for (const task of tasks)
    for (const slot of task.slots)
      if (isSameDay(new Date(slot.start_date), day))
        daySlots.push({ task, slot });

  const taskIds = [...new Set(daySlots.map((ds) => ds.task.id))];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="w-full" style={{ minWidth: `${taskIds.length * TASK_COL_MIN_WIDTH + 50}px` }}>
      {/* Task name headers — sticky */}
      <div className="sticky top-0 z-20 flex gap-1 pl-1 mb-1 bg-white pb-1">
        {taskIds.map((taskId) => {
          const task = taskMap.get(taskId);
          const taskSlots = daySlots.filter((ds) => ds.task.id === taskId);
          const times = taskSlots.map(({ slot }) => `${fmt(slot.start_date)}-${fmt(slot.end_date)}`);
          const taskAssignments = assignments.filter((a) => taskSlots.some((ts) => ts.slot.id === a.slot));
          return (
            <TaskHeader
              key={taskId}
              task={task!}
              times={times}
              slots={taskSlots.map((ts) => ts.slot)}
              assignments={taskAssignments}
              isAdmin={isAdmin}
              eventId={eventId}
            />
          );
        })}
      </div>

      {/* Timeline grid */}
      <div className="relative border-l border-gray-200" style={{ height: `${totalHeight}px` }}>
        {hours.map((h, i) => (
          <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
            style={{ top: `${i * PX_PER_HOUR}px` }}>
            <span className="absolute -left-12 -top-2 text-[10px] text-gray-400 w-10 text-right">{formatHour(h)}</span>
          </div>
        ))}
        {/* Bottom boundary label */}
        <div className="absolute left-0 right-0 border-t border-gray-200" style={{ top: `${totalHeight}px` }}>
          <span className="absolute -left-12 -top-2 text-[10px] text-gray-400 w-10 text-right">{formatHour(endHour)}</span>
        </div>
        <div className="absolute inset-0 flex gap-1 pl-1">
          {taskIds.map((taskId) => (
            <div key={taskId} className="relative flex-1" style={{ minWidth: `${TASK_COL_MIN_WIDTH}px` }}>
              {daySlots.filter((ds) => ds.task.id === taskId).map(({ task, slot }) => (
                <TimelineSlot
                  key={slot.id} slot={slot} task={task} startHour={startHour}
                  slotAssignments={assignments.filter((a) => a.slot === slot.id)}
                  userId={userId} eventId={eventId} isAdmin={isAdmin}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlanningView({ eventId, isAdmin = false }: { eventId: number; isAdmin?: boolean }) {
  const { tasks, isLoading } = useTaskStore();
  const { assignments } = useAssignmentStore();
  const user = useAuthStore((s) => s.user);
  const days = useMemo(() => getEventDays(tasks), [tasks]);
  const [dayIndex, setDayIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [transposed, setTransposed] = useState(false);

  if (isLoading && tasks.length === 0)
    return <div className="h-64 animate-pulse rounded-lg bg-gray-200" />;

  if (days.length === 0)
    return (
      <div className="py-12 text-center text-gray-500">
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-400" /><p>Aucun créneau à afficher.</p>
      </div>
    );

  const currentDay = days[dayIndex];

  const content = (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {/* Navigation jour — groupée */}
        <div className="flex items-center gap-1">
          <button onClick={() => setDayIndex((i) => Math.max(0, i - 1))} disabled={dayIndex === 0}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 capitalize">
            {formatDayHeader(currentDay)}
            <span className="ml-1.5 text-xs text-gray-400">{dayIndex + 1}/{days.length}</span>
          </span>
          <button onClick={() => setDayIndex((i) => Math.min(days.length - 1, i + 1))} disabled={dayIndex === days.length - 1}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button onClick={() => toast.info("Impression à venir")} title="Imprimer"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Printer className="h-4 w-4" />
          </button>
          <button onClick={() => setTransposed((v) => !v)} title="Transposer tâches / heures"
            className={cn("rounded-lg p-2 hover:bg-gray-100", transposed ? "text-indigo-600 bg-indigo-50" : "text-gray-400 hover:text-gray-600")}>
            <ArrowRightLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setFullscreen((v) => !v)} title={fullscreen ? "Quitter plein écran" : "Plein écran"}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="overflow-auto pb-4 -mx-4 px-4" style={{ maxHeight: "calc(100vh - 120px)" }}>
        {transposed ? (
          <>
            <div className="md:hidden">
              <TransposedDayColumn day={currentDay} tasks={tasks} assignments={assignments} userId={user?.id} eventId={eventId} isAdmin={isAdmin} />
            </div>
            <div className="hidden md:flex flex-col gap-6">
              {days.map((day) => (
                <TransposedDayColumn key={day.toISOString()} day={day} tasks={tasks} assignments={assignments} userId={user?.id} eventId={eventId} isAdmin={isAdmin} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="md:hidden pl-14">
              <DayColumn day={currentDay} tasks={tasks} assignments={assignments} userId={user?.id} eventId={eventId} isAdmin={isAdmin} />
            </div>
            <div className="hidden md:flex gap-6 pl-14">
              {days.map((day) => (
                <DayColumn key={day.toISOString()} day={day} tasks={tasks} assignments={assignments} userId={user?.id} eventId={eventId} isAdmin={isAdmin} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-auto p-4">
        {content}
      </div>
    );
  }

  return content;
}
