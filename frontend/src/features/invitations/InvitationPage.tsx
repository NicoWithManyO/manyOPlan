import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
  type UseFormSetError,
  useForm,
} from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { acceptInvitation, getInvitationPreview } from "../../api/invitations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuthStore } from "../../stores/authStore";
import type { InvitationPreview } from "../../types/models";

const signupSchema = z
  .object({
    email: z.string().email("Email invalide"),
    first_name: z.string().min(1, "Prénom requis"),
    last_name: z.string().min(1, "Nom requis"),
    nickname: z.string().max(60, "60 caractères maximum").optional(),
    password: z.string().min(8, "8 caractères minimum"),
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["password_confirm"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function invalidReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "expired":
      return "Cette invitation a expiré.";
    case "exhausted":
      return "Cette invitation a atteint sa limite d'utilisations.";
    default:
      return "Cette invitation n'est plus valide.";
  }
}

export function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setTokens = useAuthStore((s) => s.setTokens);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoadError("Lien invalide.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await getInvitationPreview(token);
        if (!cancelled) setPreview(data);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        if (!cancelled) {
          setLoadError(
            error.response?.status === 404
              ? "Invitation introuvable."
              : "Impossible de charger l'invitation.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAuthenticatedAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await acceptInvitation(token);
      toast.success("Vous avez rejoint l'événement !");
      navigate(`/events/${res.event_id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Impossible de rejoindre.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Wrapper>
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      </Wrapper>
    );
  }

  if (loadError || !preview) {
    return (
      <Wrapper>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Invitation</h2>
        <p className="mb-4 text-sm text-red-700">{loadError ?? "Invitation indisponible."}</p>
        <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Retour à l'accueil
        </Link>
      </Wrapper>
    );
  }

  if (!preview.is_valid) {
    return (
      <Wrapper>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Invitation</h2>
        <p className="mb-4 text-sm text-red-700">
          {invalidReasonLabel(preview.invalid_reason)}
        </p>
        <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Retour à l'accueil
        </Link>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="mb-5">
        <p className="text-xs uppercase tracking-wider text-indigo-600">
          Invitation
        </p>
        <h2 className="mt-1 text-xl font-semibold text-gray-900">
          {preview.event_name}
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          {preview.organization_name}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
          <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {formatDate(preview.event_start_date)}
            {" → "}
            {formatDate(preview.event_end_date)}
          </span>
        </p>
      </div>

      {isAuthenticated ? (
        <AuthenticatedAcceptBlock
          eventName={preview.event_name}
          organizationName={preview.organization_name}
          submitting={submitting}
          onAccept={handleAuthenticatedAccept}
        />
      ) : (
        <SignupBlock
          token={token!}
          eventName={preview.event_name}
          organizationName={preview.organization_name}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onSuccess={async (eventId) => {
            await fetchUser();
            navigate(`/events/${eventId}`);
          }}
          setTokens={setTokens}
        />
      )}
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">ManyOPlan</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestion de bénévoles simplifiée
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}

function AuthenticatedAcceptBlock({
  eventName,
  organizationName,
  submitting,
  onAccept,
}: {
  eventName: string;
  organizationName: string;
  submitting: boolean;
  onAccept: () => void;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-gray-700">
        Rejoindre <span className="font-semibold">{eventName}</span> dans{" "}
        <span className="font-semibold">{organizationName}</span> ?
      </p>
      <Button
        className="w-full"
        size="lg"
        onClick={onAccept}
        isLoading={submitting}
      >
        Confirmer
      </Button>
    </div>
  );
}

function SignupBlock({
  token,
  eventName,
  organizationName,
  submitting,
  setSubmitting,
  onSuccess,
  setTokens,
}: {
  token: string;
  eventName: string;
  organizationName: string;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onSuccess: (eventId: number) => Promise<void>;
  setTokens: (tokens: { access: string; refresh: string }) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupFormData>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupFormData) => {
    setSubmitting(true);
    try {
      const res = await acceptInvitation(token, {
        email: data.email,
        password: data.password,
        password_confirm: data.password_confirm,
        first_name: data.first_name,
        last_name: data.last_name,
        nickname: data.nickname?.trim() || undefined,
      });
      if (res.tokens) setTokens(res.tokens);
      toast.success("Compte créé. Bienvenue !");
      await onSuccess(res.event_id);
    } catch (err: unknown) {
      handleApiError(err, setError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <p className="mb-4 text-sm text-gray-700">
        Vous êtes invité·e à rejoindre{" "}
        <span className="font-semibold">{eventName}</span> dans{" "}
        <span className="font-semibold">{organizationName}</span>. Créez votre
        compte pour participer.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <PersonalFields register={register} errors={errors} />
        {errors.root && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {errors.root.message}
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={submitting}
        >
          Créer mon compte et rejoindre
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link
          to={`/login?next=/invite/${token}`}
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}

type PersonalFormFields = {
  first_name: string;
  last_name: string;
  nickname?: string;
  email: string;
  password: string;
  password_confirm: string;
};

function PersonalFields<T extends PersonalFormFields>({
  register,
  errors,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}) {
  const errs = errors as FieldErrors<PersonalFormFields>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="first_name"
          label="Prénom"
          autoComplete="given-name"
          error={errs.first_name?.message}
          {...register("first_name" as Path<T>)}
        />
        <Input
          id="last_name"
          label="Nom"
          autoComplete="family-name"
          error={errs.last_name?.message}
          {...register("last_name" as Path<T>)}
        />
      </div>
      <div>
        <Input
          id="nickname"
          label="Surnom (optionnel)"
          autoComplete="nickname"
          placeholder="Ex : Niko"
          error={errs.nickname?.message}
          {...register("nickname" as Path<T>)}
        />
        <p className="mt-1 text-xs text-gray-500">
          Affiché dans les plannings. Vide → « Prénom L. ».
        </p>
      </div>
      <Input
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errs.email?.message}
        {...register("email" as Path<T>)}
      />
      <Input
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        error={errs.password?.message}
        {...register("password" as Path<T>)}
      />
      <Input
        id="password_confirm"
        label="Confirmer"
        type="password"
        autoComplete="new-password"
        error={errs.password_confirm?.message}
        {...register("password_confirm" as Path<T>)}
      />
    </>
  );
}

function handleApiError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
) {
  const error = err as { response?: { data?: Record<string, unknown> } };
  const data = error.response?.data;
  if (!data) {
    setError("root", { message: "Erreur lors de l'inscription" });
    return;
  }
  for (const [field, msg] of Object.entries(data)) {
    if (Array.isArray(msg)) {
      setError(field as Path<T>, { message: String(msg[0]) });
    } else if (typeof msg === "object" && msg !== null) {
      for (const [, nestedMsg] of Object.entries(msg as Record<string, unknown>)) {
        const arr = Array.isArray(nestedMsg) ? nestedMsg : [nestedMsg];
        setError("root", { message: String(arr[0]) });
      }
    } else {
      setError(field as Path<T>, { message: String(msg) });
    }
  }
}
