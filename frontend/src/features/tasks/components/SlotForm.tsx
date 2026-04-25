import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useTaskStore } from "../../../stores/taskStore";

const schema = z
  .object({
    start_date: z.string().min(1, "Début requis"),
    end_date: z.string().min(1, "Fin requise"),
    capacity: z.coerce.number().int().positive().nullable(),
  })
  .refine((d) => new Date(d.start_date) < new Date(d.end_date), {
    message: "La fin doit être après le début",
    path: ["end_date"],
  });

type FormData = z.infer<typeof schema>;

export function SlotForm({
  eventId,
  taskId,
  onDone,
}: {
  eventId: number;
  taskId: number;
  onDone: () => void;
}) {
  const { createSlot } = useTaskStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { capacity: null },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await createSlot(eventId, taskId, {
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
        capacity: data.capacity,
      });
      toast.success("Créneau ajouté");
      onDone();
    } catch {
      toast.error("Erreur lors de la création du créneau");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          id="slot-start"
          label="Début"
          type="datetime-local"
          error={errors.start_date?.message}
          {...register("start_date")}
        />
        <Input
          id="slot-end"
          label="Fin"
          type="datetime-local"
          error={errors.end_date?.message}
          {...register("end_date")}
        />
      </div>
      <Input
        id="slot-capacity"
        label="Capacité (vide = illimité)"
        type="number"
        min={1}
        {...register("capacity")}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          Ajouter
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
