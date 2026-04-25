import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useTaskStore } from "../../../stores/taskStore";
import type { Task } from "../../../types/models";
import { cn } from "../../../utils/cn";

const optionalInt = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === "" || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  });

const schema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string(),
  min_volunteers: optionalInt,
  max_volunteers: optionalInt,
  // Slot fields (creation only)
  slot_start: z.string().optional(),
  slot_end: z.string().optional(),
  slot_capacity: optionalInt,
});

type FormData = z.infer<typeof schema>;

function toLocalDatetime(isoStr: string) {
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function TaskForm({
  eventId,
  task,
  onDone,
  eventStartDate,
  eventEndDate,
}: {
  eventId: number;
  task?: Task;
  onDone: () => void;
  eventStartDate?: string;
  eventEndDate?: string;
}) {
  const { createTask, updateTask, createSlot, deleteSlot } = useTaskStore();
  const isEdit = !!task;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: task
      ? {
          name: task.name,
          description: task.description,
          min_volunteers: task.min_volunteers,
          max_volunteers: task.max_volunteers,
        }
      : {
          name: "",
          description: "",
          min_volunteers: null,
          max_volunteers: null,
          slot_start: eventStartDate ? toLocalDatetime(eventStartDate) : "",
          slot_end: eventEndDate ? toLocalDatetime(eventEndDate) : "",
          slot_capacity: null,
        },
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        await updateTask(eventId, task.id, {
          name: data.name,
          description: data.description,
          min_volunteers: data.min_volunteers,
          max_volunteers: data.max_volunteers,
        });
        // Add new slot if times provided
        if (data.slot_start && data.slot_end) {
          await createSlot(eventId, task.id, {
            start_date: new Date(data.slot_start).toISOString(),
            end_date: new Date(data.slot_end).toISOString(),
            capacity: data.slot_capacity,
          });
        }
        toast.success("Tâche modifiée");
      } else {
        const newTask = await createTask(eventId, {
          name: data.name,
          description: data.description,
          min_volunteers: data.min_volunteers,
          max_volunteers: data.max_volunteers,
        });
        // Create slot if times provided
        if (data.slot_start && data.slot_end) {
          await createSlot(eventId, newTask.id, {
            start_date: new Date(data.slot_start).toISOString(),
            end_date: new Date(data.slot_end).toISOString(),
            capacity: data.slot_capacity,
          });
        }
        toast.success("Tâche créée");
      }
      onDone();
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Input
        id="task-name"
        label="Nom de la tâche"
        autoFocus
        error={errors.name?.message}
        {...register("name")}
      />
      <div>
        <label
          htmlFor="task-desc"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          id="task-desc"
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
          {...register("description")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="min-vol"
          label="Min bénévoles"
          type="number"
          min={0}
          placeholder="Facultatif"
          {...register("min_volunteers")}
        />
        <Input
          id="max-vol"
          label="Max bénévoles"
          type="number"
          min={0}
          placeholder="Facultatif"
          {...register("max_volunteers")}
        />
      </div>

      {/* Existing slots (edit mode) */}
      {isEdit && task.slots.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">Créneaux existants</p>
          {task.slots.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 text-gray-700">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                {new Date(s.start_date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {" → "}
                {new Date(s.end_date).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                {s.capacity !== null && <span className="text-gray-400 ml-1">({s.capacity} places)</span>}
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Supprimer ce créneau ?")) return;
                  try {
                    await deleteSlot(eventId, task.id, s.id);
                    toast.success("Créneau supprimé");
                  } catch { toast.error("Erreur"); }
                }}
                className="rounded p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New slot fields */}
      <div className="border-t border-gray-200 pt-3 mt-3 space-y-3">
        <p className="text-xs font-medium text-gray-700">
          {isEdit ? "Ajouter un créneau" : "Créneau horaire"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="slot-start"
            label="Début"
            type="datetime-local"
            {...register("slot_start")}
          />
          <Input
            id="slot-end"
            label="Fin"
            type="datetime-local"
            {...register("slot_end")}
          />
        </div>
        <Input
          id="slot-cap"
          label="Capacité"
          type="number"
          min={1}
          placeholder="Illimité"
          {...register("slot_capacity")}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" isLoading={isSubmitting} className="flex-1">
          {isEdit ? "Modifier" : "Créer"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function TaskPanel({
  eventId,
  isAdmin,
  eventStartDate,
  eventEndDate,
}: {
  eventId: number;
  isAdmin: boolean;
  eventStartDate?: string;
  eventEndDate?: string;
}) {
  const { tasks, deleteTask } = useTaskStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  const handleDelete = async (task: Task) => {
    if (!confirm(`Supprimer la tâche "${task.name}" ?`)) return;
    try {
      await deleteTask(eventId, task.id);
      toast.success("Tâche supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Tâches ({tasks.length})
        </h3>
        {isAdmin && !showForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingTask(undefined);
              setShowForm(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <TaskForm
            eventId={eventId}
            task={editingTask}
            eventStartDate={eventStartDate}
            eventEndDate={eventEndDate}
            onDone={() => {
              setShowForm(false);
              setEditingTask(undefined);
            }}
          />
        </div>
      )}

      {tasks.length === 0 && !showForm && (
        <p className="py-4 text-center text-sm text-gray-500">
          Aucune tâche. {isAdmin && "Créez-en une !"}
        </p>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {task.name}
              </p>
              <p className="text-xs text-gray-500">
                {task.slot_count} créneau{task.slot_count !== 1 ? "x" : ""}
                {task.max_volunteers && ` · max ${task.max_volunteers} bénévoles`}
              </p>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 gap-1 ml-2">
                <button
                  onClick={() => {
                    setEditingTask(task);
                    setShowForm(true);
                  }}
                  className={cn(
                    "rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600",
                    "min-h-[36px] min-w-[36px] flex items-center justify-center",
                  )}
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(task)}
                  className={cn(
                    "rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600",
                    "min-h-[36px] min-w-[36px] flex items-center justify-center",
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Used inline — import from lucide
function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
