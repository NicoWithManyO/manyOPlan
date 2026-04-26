import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CheckCircle,
  Clock,
  GripVertical,
  LogOut,
  Plus,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { useAssignmentStore } from "../../stores/assignmentStore";
import { useAuthStore } from "../../stores/authStore";
import { useTaskStore } from "../../stores/taskStore";
import type { Assignment, Slot, Task } from "../../types/models";
import { cn } from "../../utils/cn";
import { SlotForm } from "../tasks/components/SlotForm";

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Extract HH:MM from ISO string for time input
function toTimeInput(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// Build ISO from slot date + time string "HH:MM"
function buildDateTime(slotDateStr: string, time: string) {
  const d = new Date(slotDateStr);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

// --- Time picker for registration ---
function RegisterForm({
  slot,
  eventId,
  onDone,
}: {
  slot: Slot;
  eventId: number;
  onDone: () => void;
}) {
  const { register: registerSlot } = useAssignmentStore();
  const [startTime, setStartTime] = useState(toTimeInput(slot.start_date));
  const [endTime, setEndTime] = useState(toTimeInput(slot.end_date));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const startDate = buildDateTime(slot.start_date, startTime);
    const endDate = buildDateTime(slot.start_date, endTime);

    if (startDate >= endDate) {
      setError("La fin doit être après le début");
      return;
    }

    setBusy(true);
    try {
      const result = await registerSlot(eventId, slot.id, startDate, endDate);
      if (result.status === "backup") {
        toast.info("Créneau complet — inscrit en secours");
      } else {
        toast.success("Inscrit !");
      }
      onDone();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: string } } };
      setError(apiErr.response?.data?.detail ?? "Erreur lors de l'inscription");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">Choisissez vos heures</span>
        <button type="button" onClick={onDone} className="rounded p-0.5 text-gray-400 hover:text-gray-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          min={toTimeInput(slot.start_date)}
          max={toTimeInput(slot.end_date)}
          className="min-h-[40px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          min={toTimeInput(slot.start_date)}
          max={toTimeInput(slot.end_date)}
          className="min-h-[40px] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" size="sm" className="w-full" isLoading={busy}>
        Confirmer
      </Button>
    </form>
  );
}

// --- Draggable volunteer chip (admin only, desktop) ---
function VolunteerChip({
  assignment,
  isAdmin,
}: {
  assignment: Assignment;
  isAdmin: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `assignment-${assignment.id}`,
    data: { assignment },
    disabled: !isAdmin,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        isDragging && "opacity-30",
        isAdmin && "cursor-grab active:cursor-grabbing",
      )}
    >
      {isAdmin && (
        <span {...listeners} {...attributes} className="hidden md:flex touch-none">
          <GripVertical className="h-3 w-3 text-gray-300" />
        </span>
      )}
      {assignment.status === "confirmed" ? (
        <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <ShieldAlert className="h-3 w-3 shrink-0 text-amber-500" />
      )}
      <span
        className={cn(
          "truncate",
          assignment.status === "confirmed" ? "text-gray-700" : "text-amber-600",
        )}
      >
        {assignment.full_name}
      </span>
      <span className="shrink-0 text-[10px] text-gray-400">
        {formatTime(assignment.start_date)}-{formatTime(assignment.end_date)}
      </span>
      {assignment.status === "backup" && (
        <span className="text-[10px] text-amber-500">(s)</span>
      )}
    </div>
  );
}

// --- Overlay chip shown while dragging ---
function DragOverlayChip({ assignment }: { assignment: Assignment }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs shadow-lg">
      {assignment.status === "confirmed" ? (
        <CheckCircle className="h-3 w-3 text-emerald-500" />
      ) : (
        <ShieldAlert className="h-3 w-3 text-amber-500" />
      )}
      <span className="font-medium text-gray-900">{assignment.full_name}</span>
    </div>
  );
}

// --- Droppable slot card ---
function SlotCard({
  slot,
  eventId,
  taskId,
  isAdmin,
  isMember,
  slotAssignments,
  myAssignments,
  isDropTarget,
}: {
  slot: Slot;
  eventId: number;
  taskId: number;
  isAdmin: boolean;
  isMember: boolean;
  slotAssignments: Assignment[];
  myAssignments: Assignment[];
  isDropTarget: boolean;
}) {
  const { deleteSlot } = useTaskStore();
  const { unregister } = useAssignmentStore();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { slotId: slot.id, taskId },
  });

  const confirmed = slotAssignments.filter((a) => a.status === "confirmed").length;
  const capacity = slot.capacity;
  const fillPercent = capacity ? Math.min((confirmed / capacity) * 100, 100) : 0;
  const isFull = capacity !== null && confirmed >= capacity;

  const hasMine = myAssignments.length > 0;
  const hasMineConfirmed = myAssignments.some((a) => a.status === "confirmed");

  const handleUnregister = async (mine: Assignment) => {
    if (!confirm("Se désinscrire de cette plage ?")) return;
    setBusyId(mine.id);
    try {
      await unregister(eventId, mine.id);
      toast.success("Désinscrit");
    } catch {
      toast.error("Erreur");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce créneau ?")) return;
    try {
      await deleteSlot(eventId, taskId, slot.id);
      toast.success("Créneau supprimé");
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border p-3 transition",
        isDropTarget && isOver
          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/30"
          : isDropTarget
            ? "border-dashed border-indigo-300"
            : "",
        !isDropTarget && hasMine
          ? hasMineConfirmed
            ? "border-indigo-300 bg-indigo-50"
            : "border-amber-300 bg-amber-50"
          : !isDropTarget && isFull
            ? "border-amber-200 bg-amber-50/50"
            : !isDropTarget
              ? "border-gray-200 bg-white"
              : "",
      )}
    >
      {/* Time + admin delete */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-indigo-500" />
            {formatTime(slot.start_date)} - {formatTime(slot.end_date)}
          </div>
          <div className="mt-0.5 text-xs text-gray-500 pl-5.5">
            {formatDate(slot.start_date)}
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleDelete}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Capacity */}
      <div className="mb-2 flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-xs text-gray-600">
          {confirmed}
          {capacity !== null ? ` / ${capacity}` : ""} inscrit
          {confirmed !== 1 ? "s" : ""}
        </span>
        {isFull && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            Complet
          </span>
        )}
      </div>

      {capacity !== null && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isFull ? "bg-amber-500" : "bg-indigo-500",
            )}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      )}

      {/* Assigned people with their chosen times */}
      {slotAssignments.length > 0 && (
        <div className="mb-2 space-y-1">
          {slotAssignments.map((a) => (
            <VolunteerChip key={a.id} assignment={a} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {/* Action buttons */}
      {isMember && (
        <div className="mt-2 space-y-1">
          {myAssignments.map((mine) => (
            <button
              key={mine.id}
              onClick={() => handleUnregister(mine)}
              disabled={busyId === mine.id}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
                "min-h-[40px]",
                mine.status === "confirmed"
                  ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-200",
              )}
            >
              <LogOut className="h-3.5 w-3.5" />
              Se désinscrire ({formatTime(mine.start_date)}-{formatTime(mine.end_date)})
            </button>
          ))}

          {showRegisterForm ? (
            <RegisterForm
              slot={slot}
              eventId={eventId}
              onDone={() => setShowRegisterForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowRegisterForm(true)}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
                "min-h-[40px]",
                hasMine
                  ? "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                  : isFull
                    ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "bg-indigo-600 text-white hover:bg-indigo-700",
              )}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {hasMine ? "Ajouter une plage" : isFull ? "S'inscrire (secours)" : "S'inscrire"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskColumn({
  task,
  eventId,
  isAdmin,
  isMember,
  assignments,
  userId,
  isDragging,
}: {
  task: Task;
  eventId: number;
  isAdmin: boolean;
  isMember: boolean;
  assignments: Assignment[];
  userId: number | undefined;
  isDragging: boolean;
}) {
  const [showSlotForm, setShowSlotForm] = useState(false);

  return (
    <div className="min-w-[260px] flex-1">
      <div className="mb-3 rounded-lg bg-gray-100 px-3 py-2">
        <h4 className="text-sm font-semibold text-gray-900">{task.name}</h4>
        {task.description && (
          <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
            {task.description}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {task.slot_count} créneau{task.slot_count !== 1 ? "x" : ""}
          {task.max_volunteers && ` · max ${task.max_volunteers}`}
        </p>
      </div>

      <div className="space-y-2">
        {task.slots.map((slot) => {
          const slotAssignments = assignments.filter((a) => a.slot === slot.id);
          const myAssignments = userId
            ? slotAssignments.filter((a) => a.user === userId)
            : [];
          return (
            <SlotCard
              key={slot.id}
              slot={slot}
              eventId={eventId}
              taskId={task.id}
              isAdmin={isAdmin}
              isMember={isMember}
              slotAssignments={slotAssignments}
              myAssignments={myAssignments}
              isDropTarget={isDragging}
            />
          );
        })}
      </div>

      {isAdmin && (
        <div className="mt-2">
          {showSlotForm ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
              <SlotForm
                eventId={eventId}
                taskId={task.id}
                onDone={() => setShowSlotForm(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowSlotForm(true)}
              className={cn(
                "flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300",
                "px-3 py-2.5 text-xs text-gray-500 transition",
                "hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50",
                "min-h-[44px]",
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un créneau
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TableView({
  eventId,
  isAdmin,
}: {
  eventId: number;
  isAdmin: boolean;
}) {
  const { tasks, isLoading } = useTaskStore();
  const { assignments, moveAssignment } = useAssignmentStore();
  const user = useAuthStore((s) => s.user);
  const [draggedAssignment, setDraggedAssignment] = useState<Assignment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const assignment = event.active.data.current?.assignment as Assignment | undefined;
    if (assignment) setDraggedAssignment(assignment);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDraggedAssignment(null);
      const { active, over } = event;
      if (!over) return;

      const assignment = active.data.current?.assignment as Assignment | undefined;
      const newSlotId = over.data.current?.slotId as number | undefined;
      if (!assignment || !newSlotId || assignment.slot === newSlotId) return;

      try {
        await moveAssignment(eventId, assignment.id, newSlotId);
        toast.success(`${assignment.full_name} déplacé`);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } } };
        toast.error(error.response?.data?.detail ?? "Erreur lors du déplacement");
      }
    },
    [eventId, moveAssignment],
  );

  const handleDragCancel = useCallback(() => {
    setDraggedAssignment(null);
  }, []);

  if (isLoading && tasks.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-400" />
        <p>Aucune tâche pour cet événement.</p>
        {isAdmin && (
          <p className="mt-1 text-sm">
            Utilisez l'onglet Tâches pour en créer.
          </p>
        )}
      </div>
    );
  }

  const columns = tasks.map((task) => (
    <TaskColumn
      key={task.id}
      task={task}
      eventId={eventId}
      isAdmin={isAdmin}
      isMember={true}
      assignments={assignments}
      userId={user?.id}
      isDragging={draggedAssignment !== null}
    />
  ));

  if (isAdmin) {
    return (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-6 md:hidden">{columns}</div>
        <div className="hidden md:block">
          <div className="flex gap-4 overflow-x-auto pb-4">{columns}</div>
        </div>
        <DragOverlay dropAnimation={null}>
          {draggedAssignment && <DragOverlayChip assignment={draggedAssignment} />}
        </DragOverlay>
      </DndContext>
    );
  }

  return (
    <>
      <div className="space-y-6 md:hidden">{columns}</div>
      <div className="hidden md:block">
        <div className="flex gap-4 overflow-x-auto pb-4">{columns}</div>
      </div>
    </>
  );
}
