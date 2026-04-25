import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import * as orgsApi from "../../api/organizations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useOrgStore } from "../../stores/orgStore";

const inviteCodeRegex = /^[A-Za-z0-9_-]{4,32}$/;

const schema = z.object({
  name: z.string().min(1, "Nom requis").max(120),
  invite_code: z
    .string()
    .regex(inviteCodeRegex, "4-32 caractères : lettres, chiffres, tirets, underscores"),
});

type FormData = z.infer<typeof schema>;

function generateRandomCode(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function CreateOrgForm({ onSuccess }: { onSuccess: (id: number) => void }) {
  const fetchMyOrgs = useOrgStore((s) => s.fetchMyOrgs);
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const org = await orgsApi.createOrg({ name: data.name, invite_code: data.invite_code });
      await fetchMyOrgs();
      setCurrentOrg(org);
      toast.success(`Association « ${org.name} » créée !`);
      onSuccess(org.id);
    } catch (err: unknown) {
      const error = err as { response?: { data?: Record<string, string[] | string> } };
      const data = error.response?.data;
      if (!data) {
        toast.error("Erreur");
        return;
      }
      for (const [field, msg] of Object.entries(data)) {
        const arr = Array.isArray(msg) ? msg : [msg];
        if (field in schema.shape) {
          setError(field as keyof FormData, { message: String(arr[0]) });
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="org_name"
        label="Nom de l'association"
        error={errors.name?.message}
        {...register("name")}
      />
      <div>
        <Input
          id="invite_code"
          label="Code d'invitation"
          error={errors.invite_code?.message}
          {...register("invite_code")}
        />
        <button
          type="button"
          onClick={() =>
            setValue("invite_code", generateRandomCode(), { shouldValidate: true })
          }
          className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500"
        >
          <Sparkles className="h-3 w-3" />
          Générer un code aléatoire
        </button>
      </div>
      <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
        Créer l'association
      </Button>
    </form>
  );
}
