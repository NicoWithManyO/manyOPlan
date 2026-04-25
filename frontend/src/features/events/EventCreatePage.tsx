import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useEventStore } from "../../stores/eventStore";
import { useOrgStore } from "../../stores/orgStore";

const schema = z
  .object({
    name: z.string().min(1, "Nom requis").max(255),
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

export function EventCreatePage() {
  const navigate = useNavigate();
  const createEvent = useEventStore((s) => s.createEvent);
  const currentOrg = useOrgStore((s) => s.currentOrg);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      event_type: "other",
      description: "",
    },
  });

  if (!currentOrg) {
    return (
      <div className="rounded-xl bg-white p-6 text-sm text-gray-600 ring-1 ring-gray-200">
        Aucune association sélectionnée.
      </div>
    );
  }

  if (currentOrg.my_role !== "admin") {
    return (
      <div className="rounded-xl bg-white p-6 text-sm text-gray-600 ring-1 ring-gray-200">
        Vous devez être admin de cette association pour créer un événement.
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      const event = await createEvent({
        ...data,
        organization: currentOrg.id,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
      });
      toast.success("Événement créé !");
      navigate(`/events/${event.id}`);
    } catch {
      toast.error("Erreur lors de la création");
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <Link
        to="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <h2 className="mb-1 text-2xl font-bold text-gray-900">
        Nouvel événement
      </h2>
      <p className="mb-6 text-sm text-gray-500">
        Pour l'association <strong>{currentOrg.name}</strong>
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
      >
        <Input
          id="name"
          label="Nom de l'événement"
          error={errors.name?.message}
          {...register("name")}
        />

        <div>
          <label
            htmlFor="event_type"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Type
          </label>
          <select
            id="event_type"
            className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            {...register("event_type")}
          >
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
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

        <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
          Créer l'événement
        </Button>
      </form>
    </div>
  );
}
