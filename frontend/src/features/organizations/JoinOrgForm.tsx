import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import * as orgsApi from "../../api/organizations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useOrgStore } from "../../stores/orgStore";

const inviteCodeRegex = /^[A-Za-z0-9_-]{4,32}$/;

const schema = z.object({
  invite_code: z.string().regex(inviteCodeRegex, "Format de code invalide"),
});

type FormData = z.infer<typeof schema>;

export function JoinOrgForm({ onSuccess }: { onSuccess: (id: number) => void }) {
  const fetchMyOrgs = useOrgStore((s) => s.fetchMyOrgs);
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const org = await orgsApi.joinOrg(data.invite_code);
      await fetchMyOrgs();
      setCurrentOrg(org);
      toast.success(`Vous avez rejoint « ${org.name} »`);
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
        if (field === "invite_code") {
          setError("invite_code", { message: String(arr[0]) });
        } else if (field === "detail") {
          toast.error(String(arr[0]));
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="invite_code"
        label="Code d'invitation"
        placeholder="Demandez le code à l'admin de votre association"
        error={errors.invite_code?.message}
        {...register("invite_code")}
      />
      <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
        Rejoindre l'association
      </Button>
    </form>
  );
}
