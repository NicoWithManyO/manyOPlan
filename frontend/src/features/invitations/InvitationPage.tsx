import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { acceptInvitation, getInvitationPreview } from "../../api/invitations";
import { Button } from "../../components/ui/Button";
import { AuthShell } from "../../layouts/AuthShell";
import { useAuthStore } from "../../stores/authStore";
import type { InvitationPreview } from "../../types/models";
import { handleApiError } from "../../utils/handleApiError";
import { PersonalFields } from "../auth/PersonalFields";
import { PrivacyConsent, privacyConsentField } from "../auth/PrivacyConsent";

const signupSchema = z
  .object({
    email: z.string().email("Email invalide"),
    first_name: z.string().min(1, "Prénom requis"),
    last_name: z.string().min(1, "Nom requis"),
    nickname: z.string().max(60, "60 caractères maximum").optional(),
    password: z.string().min(8, "8 caractères minimum"),
    password_confirm: z.string(),
    ...privacyConsentField,
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

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoadError("Lien invalide.");
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const data = await getInvitationPreview(token);
        if (!ctrl.signal.aborted) setPreview(data);
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return;
        const error = err as { response?: { status?: number } };
        setLoadError(
          error.response?.status === 404
            ? "Invitation introuvable."
            : "Impossible de charger l'invitation.",
        );
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [token]);

  if (loading) {
    return (
      <AuthShell>
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      </AuthShell>
    );
  }

  if (loadError || !preview) {
    return <InvitationErrorState message={loadError ?? "Invitation indisponible."} />;
  }

  if (!preview.is_valid) {
    return <InvitationErrorState message={invalidReasonLabel(preview.invalid_reason)} />;
  }

  return (
    <AuthShell>
      <InvitationHeader preview={preview} />
      {isAuthenticated ? (
        <AuthenticatedAcceptBlock
          token={token!}
          eventName={preview.event_name}
          organizationName={preview.organization_name}
        />
      ) : (
        <SignupBlock
          token={token!}
          eventName={preview.event_name}
          organizationName={preview.organization_name}
          onJoined={(eventId) => navigate(`/events/${eventId}`)}
        />
      )}
    </AuthShell>
  );
}

function InvitationErrorState({ message }: { message: string }) {
  return (
    <AuthShell>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">Invitation</h2>
      <p className="mb-4 text-sm text-red-700">{message}</p>
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        Retour à l'accueil
      </Link>
    </AuthShell>
  );
}

function InvitationHeader({ preview }: { preview: InvitationPreview }) {
  return (
    <div className="mb-5">
      <p className="text-xs uppercase tracking-wider text-indigo-600">Invitation</p>
      <h2 className="mt-1 text-xl font-semibold text-gray-900">{preview.event_name}</h2>
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
  );
}

function AuthenticatedAcceptBlock({
  token,
  eventName,
  organizationName,
}: {
  token: string;
  eventName: string;
  organizationName: string;
}) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onAccept = async () => {
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

  return (
    <div>
      <p className="mb-4 text-sm text-gray-700">
        Rejoindre <span className="font-semibold">{eventName}</span> dans{" "}
        <span className="font-semibold">{organizationName}</span> ?
      </p>
      <Button className="w-full" size="lg" onClick={onAccept} isLoading={submitting}>
        Confirmer
      </Button>
    </div>
  );
}

function SignupBlock({
  token,
  eventName,
  organizationName,
  onJoined,
}: {
  token: string;
  eventName: string;
  organizationName: string;
  onJoined: (eventId: number) => void;
}) {
  const setTokens = useAuthStore((s) => s.setTokens);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const [submitting, setSubmitting] = useState(false);
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
      await fetchUser();
      toast.success("Compte créé. Bienvenue !");
      onJoined(res.event_id);
    } catch (err: unknown) {
      handleApiError(err, setError, { fallbackMessage: "Erreur lors de l'inscription" });
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
        <PrivacyConsent
          register={register("privacy_consent")}
          error={errors.privacy_consent?.message}
        />
        {errors.root && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {errors.root.message}
          </div>
        )}
        <Button type="submit" className="w-full" size="lg" isLoading={submitting}>
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
