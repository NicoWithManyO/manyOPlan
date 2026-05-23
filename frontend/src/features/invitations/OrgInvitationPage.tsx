import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  acceptOrgInvitation,
  getOrgInvitationPreview,
} from "../../api/invitations";
import { OrgLogoBox } from "../../components/OrgLogoBox";
import { Button } from "../../components/ui/Button";
import { AuthShell } from "../../layouts/AuthShell";
import { useAuthStore } from "../../stores/authStore";
import type { OrgInvitationPreview } from "../../types/models";
import { handleApiError } from "../../utils/handleApiError";
import { PersonalFields } from "../auth/PersonalFields";
import { PrivacyConsent } from "../auth/PrivacyConsent";
import { signupSchema, type SignupFormData } from "../auth/signupSchema";
import {
  InvitationErrorState,
  InvitationLoadingState,
} from "./PublicInvitationStates";
import { invalidReasonLabel, useInvitationPreview } from "./publicShared";

export function OrgInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { loading, preview, loadError } =
    useInvitationPreview<OrgInvitationPreview>(token, getOrgInvitationPreview);

  if (loading) return <InvitationLoadingState />;

  if (loadError || !preview) {
    return <InvitationErrorState message={loadError ?? "Invitation indisponible."} />;
  }

  if (!preview.is_valid) {
    return <InvitationErrorState message={invalidReasonLabel(preview.invalid_reason)} />;
  }

  return (
    <AuthShell>
      <OrgInvitationHeader preview={preview} />
      {isAuthenticated ? (
        <AuthenticatedAcceptBlock
          token={token!}
          organizationName={preview.organization_name}
          onJoined={() => navigate("/")}
        />
      ) : (
        <SignupBlock
          token={token!}
          organizationName={preview.organization_name}
          onJoined={() => navigate("/")}
        />
      )}
    </AuthShell>
  );
}

function OrgInvitationHeader({ preview }: { preview: OrgInvitationPreview }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <OrgLogoBox
        src={preview.organization_logo}
        alt={`Logo ${preview.organization_name}`}
      />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-indigo-600">
          Invitation
        </p>
        <h2 className="mt-1 truncate text-xl font-semibold text-gray-900">
          {preview.organization_name}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Vous êtes invité·e à rejoindre cette association.
        </p>
      </div>
    </div>
  );
}

function AuthenticatedAcceptBlock({
  token,
  organizationName,
  onJoined,
}: {
  token: string;
  organizationName: string;
  onJoined: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const onAccept = async () => {
    setSubmitting(true);
    try {
      await acceptOrgInvitation(token);
      toast.success(`Vous avez rejoint ${organizationName} !`);
      onJoined();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Impossible de rejoindre.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <p className="mb-4 text-sm text-gray-700">
        Rejoindre <span className="font-semibold">{organizationName}</span> ?
      </p>
      <Button className="w-full" size="lg" onClick={onAccept} isLoading={submitting}>
        Confirmer
      </Button>
    </>
  );
}

function SignupBlock({
  token,
  organizationName,
  onJoined,
}: {
  token: string;
  organizationName: string;
  onJoined: () => void;
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
      const res = await acceptOrgInvitation(token, {
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
      onJoined();
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
          to={`/login?next=/asso-invite/${token}`}
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          Se connecter
        </Link>
      </p>
    </>
  );
}
