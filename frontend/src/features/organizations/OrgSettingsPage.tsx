import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Copy,
  Image as ImageIcon,
  KeyRound,
  Link as LinkIcon,
  RefreshCw,
  Save,
  Shield,
  ShieldOff,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import * as orgsApi from "../../api/organizations";
import { OrgLogoBox } from "../../components/OrgLogoBox";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useOrgStore } from "../../stores/orgStore";
import type { Organization, OrganizationMembership } from "../../types/models";
import { cn } from "../../utils/cn";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { pickApiError } from "../../utils/handleApiError";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_IMAGE_TYPES_ATTR,
  imageUrlSchema,
  type ImageUrlForm,
} from "../../utils/image";
import { OrgInvitationsManagement } from "./OrgInvitationsManagement";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const nameSchema = z.object({
  name: z.string().min(1, "Nom requis").max(120, "120 caractères maximum"),
});
type NameForm = z.infer<typeof nameSchema>;

const codeSchema = z.object({
  invite_code: z
    .string()
    .min(4, "4 caractères minimum")
    .max(32, "32 caractères maximum")
    .regex(/^[A-Za-z0-9_-]+$/, "Lettres, chiffres, tirets, underscores"),
});
type CodeForm = z.infer<typeof codeSchema>;


function LogoSection({
  org,
  onChange,
}: {
  org: Organization;
  onChange: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const {
    register: regUrl,
    handleSubmit: handleUrl,
    reset: resetUrl,
    formState: { errors: urlErrors, isSubmitting: urlSubmitting },
  } = useForm<ImageUrlForm>({ resolver: zodResolver(imageUrlSchema) });

  const handleFilePick = () => fileInputRef.current?.click();

  const runLogoAction = async (
    action: () => Promise<unknown>,
    successMsg: string,
    setBusy?: (v: boolean) => void,
  ) => {
    setBusy?.(true);
    try {
      await action();
      await onChange();
      toast.success(successMsg);
    } catch (err) {
      toast.error(pickApiError(err));
    } finally {
      setBusy?.(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPEG, WebP uniquement)");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("Fichier trop volumineux (max 2 Mo)");
      return;
    }
    runLogoAction(() => orgsApi.uploadLogo(org.id, file), "Logo mis à jour", setUploading);
  };

  const onUrlSubmit = async (data: ImageUrlForm) => {
    await runLogoAction(() => orgsApi.setLogoFromUrl(org.id, data.url), "Logo importé");
    resetUrl({ url: "" });
  };

  const handleRemove = () => {
    if (!confirm("Supprimer le logo de l'association ?")) return;
    runLogoAction(() => orgsApi.removeLogo(org.id), "Logo supprimé", setRemoving);
  };

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <ImageIcon className="h-4 w-4" />
        Logo
      </h3>
      <div className="flex items-start gap-4">
        <OrgLogoBox src={org.logo} alt={`Logo ${org.name}`} size="lg" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs text-gray-500">
            PNG, JPEG ou WebP. 2 Mo maximum. Redimensionnée à 512 px max (ratio conservé).
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES_ATTR}
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleFilePick}
              isLoading={uploading}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Choisir un fichier
            </Button>
            {org.logo && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRemove}
                isLoading={removing}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Supprimer
              </Button>
            )}
          </div>
          <form
            onSubmit={handleUrl(onUrlSubmit)}
            className="flex flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="flex-1">
              <Input
                id="logo_url"
                placeholder="https://exemple.com/logo.png"
                error={urlErrors.url?.message}
                {...regUrl("url")}
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" isLoading={urlSubmitting}>
              <LinkIcon className="mr-1.5 h-4 w-4" />
              Importer depuis une URL
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  onToggleRole,
  onKick,
  isOnlyAdmin,
}: {
  member: OrganizationMembership;
  onToggleRole: (m: OrganizationMembership) => void;
  onKick: (m: OrganizationMembership) => void;
  isOnlyAdmin: boolean;
}) {
  const isAdmin = member.role === "admin";
  return (
    <li className="flex items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">
          {member.full_name}
        </p>
        <p className="truncate text-xs text-gray-500">
          @{member.username} · {member.email}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            isAdmin
              ? "bg-indigo-100 text-indigo-700"
              : "bg-gray-100 text-gray-600",
          )}
        >
          {isAdmin ? "Admin" : "Membre"}
        </span>
        <button
          onClick={() => onToggleRole(member)}
          disabled={isAdmin && isOnlyAdmin}
          title={
            isAdmin
              ? isOnlyAdmin
                ? "Impossible : seul admin"
                : "Rétrograder membre"
              : "Promouvoir admin"
          }
          className={cn(
            "flex min-h-[32px] min-w-[32px] items-center justify-center rounded p-1.5 transition",
            "disabled:cursor-not-allowed disabled:opacity-40",
            isAdmin
              ? "text-amber-500 hover:bg-amber-50"
              : "text-indigo-500 hover:bg-indigo-50",
          )}
        >
          {isAdmin ? (
            <ShieldOff className="h-4 w-4" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onKick(member)}
          disabled={isAdmin && isOnlyAdmin}
          title={
            isAdmin && isOnlyAdmin ? "Impossible : seul admin" : "Exclure"
          }
          className={cn(
            "flex min-h-[32px] min-w-[32px] items-center justify-center rounded p-1.5 text-red-500 transition hover:bg-red-50",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function MemberManagement({ orgId }: { orgId: number }) {
  const [members, setMembers] = useState<OrganizationMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await orgsApi.getMembers(orgId);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [orgId]);

  const adminCount = members.filter((m) => m.role === "admin").length;

  const handleToggleRole = async (m: OrganizationMembership) => {
    const action = m.role === "admin" ? "demote" : "promote";
    const verb = action === "promote" ? "Promouvoir admin" : "Rétrograder membre";
    if (!confirm(`${verb} : ${m.full_name} ?`)) return;
    try {
      await orgsApi.memberAction(orgId, m.user, action);
      toast.success(
        action === "promote"
          ? `${m.full_name} est maintenant admin`
          : `${m.full_name} est maintenant membre`,
      );
      fetchMembers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Erreur");
    }
  };

  const handleKick = async (m: OrganizationMembership) => {
    if (!confirm(`Exclure ${m.full_name} de l'association ?`)) return;
    try {
      await orgsApi.kickMember(orgId, m.user);
      toast.success(`${m.full_name} exclu`);
      fetchMembers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Erreur");
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Users className="h-4 w-4" />
        Membres
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {members.length}
        </span>
      </h3>

      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              onToggleRole={handleToggleRole}
              onKick={handleKick}
              isOnlyAdmin={adminCount <= 1}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function OrgSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = Number(id);
  const { currentOrg, myOrgs, refreshCurrentOrg, fetchMyOrgs } = useOrgStore();

  const org = myOrgs.find((o) => o.id === orgId) ?? currentOrg;

  const {
    register: regName,
    handleSubmit: handleName,
    reset: resetName,
    formState: { errors: nameErrors, isSubmitting: nameSubmitting },
  } = useForm<NameForm>({ resolver: zodResolver(nameSchema) });

  const {
    register: regCode,
    handleSubmit: handleCode,
    reset: resetCode,
    setValue: setCodeValue,
    formState: { errors: codeErrors, isSubmitting: codeSubmitting },
  } = useForm<CodeForm>({ resolver: zodResolver(codeSchema) });

  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (org) {
      resetName({ name: org.name });
      resetCode({ invite_code: org.invite_code ?? "" });
    }
  }, [org, resetName, resetCode]);

  if (!org) {
    return <Navigate to="/events" replace />;
  }

  if (org.my_role !== "admin") {
    return <Navigate to="/events" replace />;
  }

  const onNameSubmit = async (data: NameForm) => {
    try {
      await orgsApi.updateOrg(orgId, { name: data.name });
      await Promise.all([refreshCurrentOrg(), fetchMyOrgs()]);
      toast.success("Nom mis à jour");
    } catch (err: unknown) {
      const error = err as { response?: { data?: Record<string, string[]> } };
      const detail = error.response?.data?.name?.[0];
      toast.error(detail ?? "Erreur");
    }
  };

  const refreshOrgs = async () => {
    await Promise.all([refreshCurrentOrg(), fetchMyOrgs()]);
  };

  const onCodeSubmit = async (data: CodeForm) => {
    try {
      await orgsApi.updateOrg(orgId, { invite_code: data.invite_code });
      await refreshCurrentOrg();
      toast.success("Code d'invitation mis à jour");
    } catch (err: unknown) {
      const error = err as { response?: { data?: Record<string, string[]> } };
      const detail = error.response?.data?.invite_code?.[0];
      toast.error(detail ?? "Erreur");
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Générer un nouveau code aléatoire ? L'ancien code ne fonctionnera plus.")) {
      return;
    }
    setRegenerating(true);
    try {
      const { invite_code } = await orgsApi.regenerateCode(orgId);
      setCodeValue("invite_code", invite_code, { shouldDirty: false });
      await refreshCurrentOrg();
      toast.success("Nouveau code généré");
    } catch {
      toast.error("Erreur");
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (!org.invite_code) return;
    copyToClipboard(org.invite_code, "Code copié");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          to="/events"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">
          Paramètres de l'association
        </h2>
        <p className="text-sm text-gray-500">{org.name}</p>
      </div>

      {/* Informations */}
      <form
        onSubmit={handleName(onNameSubmit)}
        className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
      >
        <h3 className="text-sm font-semibold text-gray-900">Informations</h3>
        <Input
          id="name"
          label="Nom de l'association"
          error={nameErrors.name?.message}
          {...regName("name")}
        />
        <Button type="submit" size="sm" isLoading={nameSubmitting}>
          <Save className="mr-1.5 h-4 w-4" />
          Enregistrer
        </Button>
      </form>

      {/* Logo */}
      <LogoSection org={org} onChange={refreshOrgs} />

      {/* Code d'invitation */}
      <form
        onSubmit={handleCode(onCodeSubmit)}
        className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <KeyRound className="h-4 w-4" />
          Code d'invitation
        </h3>
        <p className="text-xs text-gray-500">
          Partagez ce code avec vos bénévoles pour qu'ils rejoignent l'association.
        </p>
        <Input
          id="invite_code"
          label="Code"
          error={codeErrors.invite_code?.message}
          {...regCode("invite_code")}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" isLoading={codeSubmitting}>
            <Save className="mr-1.5 h-4 w-4" />
            Enregistrer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleRegenerate}
            isLoading={regenerating}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Régénérer aléatoire
          </Button>
          {org.invite_code && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCopyCode}
            >
              <Copy className="mr-1.5 h-4 w-4" />
              Copier
            </Button>
          )}
        </div>
      </form>

      <OrgInvitationsManagement orgId={orgId} organizationLogo={org.logo} />

      {/* Membres */}
      <MemberManagement orgId={orgId} />
    </div>
  );
}
