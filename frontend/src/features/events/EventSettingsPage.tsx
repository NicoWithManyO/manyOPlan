import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Copy,
  Image as ImageIcon,
  Link2,
  Link as LinkIcon,
  Megaphone,
  Plus,
  QrCode,
  Save,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import * as eventsApi from "../../api/events";
import { searchUsers, type UserSearchResult } from "../../api/users";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useEventStore } from "../../stores/eventStore";
import type {
  Event,
  EventInvitation,
  EventMembership,
  InvitationDecoration,
} from "../../types/models";
import { cn } from "../../utils/cn";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { pickApiError } from "../../utils/handleApiError";
import { pluralSuffix } from "../../utils/pluralFr";
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_IMAGE_TYPES_ATTR,
  imageUrlSchema,
  type ImageUrlForm,
} from "../../utils/image";
import { InvitationDecorationPicker } from "../invitations/InvitationDecorationPicker";
import { InvitationEditModal } from "../invitations/InvitationEditModal";
import { InvitationQRModal } from "../invitations/InvitationQRModal";
import {
  DECORATION_TEXT,
  DEFAULT_DECORATION,
  SLUG_RE,
  buildQRCenter,
  formatDateShort,
  isManuallyToggleable,
  statusLabel,
} from "../invitations/utils";

const POSTER_MAX_BYTES = 5 * 1024 * 1024;

const schema = z
  .object({
    name: z.string().min(1, "Nom requis"),
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

function toLocalDatetime(isoStr: string) {
  const d = new Date(isoStr);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function PosterSection({
  event,
  onChange,
}: {
  event: Event;
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

  const runPosterAction = async (
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
    if (file.size > POSTER_MAX_BYTES) {
      toast.error("Fichier trop volumineux (max 5 Mo)");
      return;
    }
    runPosterAction(
      () => eventsApi.uploadEventPoster(event.id, file),
      "Affiche mise à jour",
      setUploading,
    );
  };

  const onUrlSubmit = async (data: ImageUrlForm) => {
    await runPosterAction(
      () => eventsApi.setEventPosterFromUrl(event.id, data.url),
      "Affiche importée",
    );
    resetUrl({ url: "" });
  };

  const handleRemove = () => {
    if (!confirm("Supprimer l'affiche de cet événement ?")) return;
    runPosterAction(
      () => eventsApi.removeEventPoster(event.id),
      "Affiche supprimée",
      setRemoving,
    );
  };

  return (
    <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <ImageIcon className="h-4 w-4" />
        Affiche
      </h3>
      <div className="flex items-start gap-4">
        <div className="flex aspect-[2/3] w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 ring-1 ring-gray-200">
          {event.poster ? (
            <img
              src={event.poster}
              alt={`Affiche ${event.name}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-gray-300" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs text-gray-500">
            PNG, JPEG ou WebP. 5 Mo maximum. Redimensionnée à 1600 px max (ratio conservé).
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
            {event.poster && (
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
                id="poster_url"
                placeholder="https://exemple.com/affiche.jpg"
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

function InvitationsManagement({
  eventId,
  organizationLogo,
}: {
  eventId: number;
  organizationLogo: string | null;
}) {
  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [decoration, setDecoration] = useState<InvitationDecoration>(DEFAULT_DECORATION);
  const [qrInvitation, setQrInvitation] = useState<EventInvitation | null>(null);
  const [editingInvitation, setEditingInvitation] = useState<EventInvitation | null>(null);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getEventInvitations(eventId);
      setInvitations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [eventId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlugError(null);
    const slug = customSlug.trim();
    if (slug && !SLUG_RE.test(slug)) {
      setSlugError("2-60 caractères : lettres, chiffres, tirets, underscores.");
      return;
    }
    const decorationText = decoration.decoration_text.trim();
    if (decoration.decoration_type === DECORATION_TEXT && !decorationText) {
      toast.error("Saisis un texte ou choisis le logo.");
      return;
    }
    setCreating(true);
    try {
      await eventsApi.createEventInvitation(eventId, {
        label: label.trim() || undefined,
        token: slug || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_uses: maxUses ? Number(maxUses) : null,
        decoration_type: decoration.decoration_type,
        decoration_text: decorationText,
        decoration_bg_color: decoration.decoration_bg_color,
        decoration_text_color: decoration.decoration_text_color,
      });
      toast.success("Invitation créée");
      setLabel("");
      setCustomSlug("");
      setExpiresAt("");
      setMaxUses("");
      setDecoration(DEFAULT_DECORATION);
      setShowForm(false);
      fetchInvitations();
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { detail?: string; token?: string[] } };
      };
      const tokenErr = error.response?.data?.token?.[0];
      if (tokenErr) {
        setSlugError(tokenErr);
      } else {
        toast.error(error.response?.data?.detail ?? "Erreur");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (inv: EventInvitation) => {
    if (!confirm("Supprimer cette invitation ? Le lien deviendra inutilisable.")) return;
    try {
      await eventsApi.deleteEventInvitation(eventId, inv.id);
      toast.success("Invitation supprimée");
      fetchInvitations();
    } catch {
      toast.error("Erreur");
    }
  };

  const handleCopy = (token: string) => {
    copyToClipboard(`${window.location.origin}/invite/${token}`, "Lien copié");
  };

  const handleTogglePromote = async (inv: EventInvitation) => {
    const next = !inv.is_promoted;
    setInvitations((list) =>
      list.map((i) => (i.id === inv.id ? { ...i, is_promoted: next } : i)),
    );
    try {
      await eventsApi.updateEventInvitation(eventId, inv.id, {
        is_promoted: next,
      });
      toast.success(next ? "Lien promu" : "Promotion retirée");
    } catch {
      setInvitations((list) =>
        list.map((i) => (i.id === inv.id ? { ...i, is_promoted: !next } : i)),
      );
      toast.error("Erreur");
    }
  };

  const handleToggleActive = async (inv: EventInvitation) => {
    const next = !inv.is_active;
    const message = next
      ? "Réactiver ce lien ? Il redeviendra utilisable."
      : "Désactiver ce lien ? Il ne sera plus utilisable.";
    if (!confirm(message)) return;
    setInvitations((list) =>
      list.map((i) => (i.id === inv.id ? { ...i, is_active: next } : i)),
    );
    try {
      await eventsApi.updateEventInvitation(eventId, inv.id, {
        is_active: next,
      });
      toast.success(next ? "Lien réactivé" : "Lien désactivé");
    } catch {
      setInvitations((list) =>
        list.map((i) => (i.id === inv.id ? { ...i, is_active: !next } : i)),
      );
      toast.error("Erreur");
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Link2 className="h-4 w-4" />
          Liens d'invitation
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {invitations.length}
          </span>
        </h3>
        {!showForm && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nouveau lien
          </Button>
        )}
      </div>

      <p className="mb-4 text-xs text-gray-500">
        Partagez ces liens pour permettre à des bénévoles de rejoindre directement
        l'événement (et l'association).
      </p>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3"
        >
          <Input
            id="inv_label"
            label="Libellé (optionnel)"
            placeholder="Ex : Bénévoles ouverture"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div>
            <Input
              id="inv_slug"
              label="Lien personnalisé (optionnel)"
              placeholder="Ex : festival2026"
              value={customSlug}
              onChange={(e) => {
                setCustomSlug(e.target.value);
                if (slugError) setSlugError(null);
              }}
              error={slugError ?? undefined}
            />
            <p className="mt-1 text-xs text-gray-500">
              Donne une URL mémorisable : <code className="rounded bg-gray-100 px-1">/invite/{customSlug || "ton-lien"}</code>. Vide → généré automatiquement.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="inv_expires_at"
              label="Expiration (optionnel)"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <Input
              id="inv_max_uses"
              label="Nb max d'utilisations (optionnel)"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
          <InvitationDecorationPicker
            value={decoration}
            onChange={setDecoration}
            hasOrgLogo={!!organizationLogo}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={creating}>
              Créer le lien
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setLabel("");
                setCustomSlug("");
                setSlugError(null);
                setExpiresAt("");
                setMaxUses("");
                setDecoration(DEFAULT_DECORATION);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
      ) : invitations.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          Aucun lien d'invitation.
        </p>
      ) : (
        <ul className="space-y-2">
          {invitations.map((inv) => {
            const status = statusLabel(inv);
            const url = `${window.location.origin}/invite/${inv.token}`;
            const toggleable = isManuallyToggleable(inv);
            return (
              <li
                key={inv.id}
                className="rounded-lg border border-gray-200 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingInvitation(inv)}
                        className="cursor-pointer text-left text-sm font-medium text-gray-900 truncate hover:text-indigo-700 hover:underline"
                        title="Modifier le libellé"
                      >
                        {inv.label || "Sans libellé"}
                      </button>
                      {toggleable ? (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(inv)}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium hover:opacity-80",
                            status.className,
                          )}
                          title={
                            inv.is_active
                              ? "Cliquer pour désactiver ce lien"
                              : "Cliquer pour réactiver ce lien"
                          }
                        >
                          {status.label}
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            status.className,
                          )}
                        >
                          {status.label}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTogglePromote(inv)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          inv.is_promoted
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                        )}
                        title={
                          inv.is_promoted
                            ? "Lien visible par tous les membres dans l'événement"
                            : "Rendre ce lien visible par tous les membres dans l'événement"
                        }
                      >
                        <Megaphone className="h-3 w-3" />
                        {inv.is_promoted ? "Promu" : "Promouvoir"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {inv.use_count}
                      {inv.max_uses != null ? ` / ${inv.max_uses}` : ""} utilisation{pluralSuffix(inv.use_count)}
                      {inv.expires_at && (
                        <>
                          {" · expire le "}
                          {formatDateShort(inv.expires_at)}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(inv)}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(inv.token)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrInvitation(inv)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    title="Afficher le QR code"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    QR
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {qrInvitation && (
        <InvitationQRModal
          token={qrInvitation.token}
          label={qrInvitation.label}
          onClose={() => setQrInvitation(null)}
          center={buildQRCenter(qrInvitation, organizationLogo)}
        />
      )}

      {editingInvitation && (
        <InvitationEditModal
          invitation={editingInvitation}
          onClose={() => setEditingInvitation(null)}
          onSave={(label) =>
            eventsApi.updateEventInvitation(eventId, editingInvitation.id, { label })
          }
          onSaved={(updated) => {
            setInvitations((list) =>
              list.map((i) => (i.id === updated.id ? updated : i)),
            );
            setEditingInvitation(null);
          }}
        />
      )}
    </div>
  );
}

// --- Member management section ---
function MemberManagement({
  eventId,
}: {
  eventId: number;
}) {
  const [members, setMembers] = useState<EventMembership[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.getMembers(eventId);
      setMembers(data.results);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [eventId]);

  const handleToggleRole = async (member: EventMembership) => {
    const newRole = member.role === "admin" ? "volunteer" : "admin";
    const action = newRole === "admin" ? "Promouvoir admin" : "Rétrograder bénévole";
    if (!confirm(`${action} : ${member.full_name} ?`)) return;
    try {
      await eventsApi.updateMemberRole(eventId, member.id, newRole);
      toast.success(
        newRole === "admin"
          ? `${member.full_name} est maintenant admin`
          : `${member.full_name} est maintenant bénévole`,
      );
      fetchMembers();
    } catch {
      toast.error("Erreur");
    }
  };

  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const memberUserIds = new Set(members.map((m) => m.user));

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchUsers(q);
        setSearchResults(results.filter((u) => !memberUserIds.has(u.id)));
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleAddMember = async (user: UserSearchResult, role: "admin" | "volunteer") => {
    try {
      await eventsApi.addMember(eventId, user.id, role);
      toast.success(`${user.full_name} ajouté`);
      setSearchQuery("");
      setSearchResults([]);
      setShowAdd(false);
      fetchMembers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error.response?.data?.detail ?? "Erreur");
    }
  };

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-gray-200" />;
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4" />
          Membres & Admins
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {members.length}
          </span>
        </h3>
        {!showAdd && (
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
            <UserPlus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Add member search */}
      {showAdd && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher par nom, email, username..."
                autoFocus
                className="w-full min-h-[40px] rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button onClick={() => { setShowAdd(false); setSearchQuery(""); setSearchResults([]); }}
              className="rounded p-1.5 text-gray-400 hover:text-gray-600">
              <span className="text-xs">Annuler</span>
            </button>
          </div>
          {searching && <p className="text-xs text-gray-400">Recherche...</p>}
          {searchResults.length > 0 && (
            <ul className="space-y-1">
              {searchResults.map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-gray-200">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                    <p className="text-xs text-gray-500">@{u.username} · {u.email}</p>
                  </div>
                  <div className="flex shrink-0 gap-1 ml-2">
                    <button
                      onClick={() => handleAddMember(u, "volunteer")}
                      className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 transition"
                    >
                      Bénévole
                    </button>
                    <button
                      onClick={() => handleAddMember(u, "admin")}
                      className="rounded-lg bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200 transition"
                    >
                      Admin
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400">Aucun utilisateur trouvé (ou déjà membre)</p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-3 gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {m.full_name}
              </p>
              <p className="text-xs text-gray-500">@{m.username}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  m.role === "admin"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-600",
                )}
              >
                {m.role === "admin" ? "Admin" : "Bénévole"}
              </span>

              <button
                onClick={() => handleToggleRole(m)}
                className={cn(
                  "rounded p-1.5 transition min-h-[32px] min-w-[32px] flex items-center justify-center",
                  m.role === "admin"
                    ? "text-amber-500 hover:bg-amber-50"
                    : "text-indigo-500 hover:bg-indigo-50",
                )}
                title={m.role === "admin" ? "Rétrograder bénévole" : "Promouvoir admin"}
              >
                {m.role === "admin" ? (
                  <ShieldOff className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Main settings page ---
export function EventSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number(id);
  const navigate = useNavigate();
  const { currentEvent, fetchEvent, updateEvent, deleteEvent } = useEventStore();

  useEffect(() => {
    if (!currentEvent || currentEvent.id !== eventId) {
      fetchEvent(eventId);
    }
  }, [eventId, currentEvent, fetchEvent]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (currentEvent) {
      reset({
        name: currentEvent.name,
        event_type: currentEvent.event_type,
        description: currentEvent.description,
        start_date: toLocalDatetime(currentEvent.start_date),
        end_date: toLocalDatetime(currentEvent.end_date),
      });
    }
  }, [currentEvent, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      await updateEvent(eventId, {
        ...data,
        start_date: new Date(data.start_date).toISOString(),
        end_date: new Date(data.end_date).toISOString(),
      });
      toast.success("Événement modifié");
      navigate(`/events/${eventId}`);
    } catch {
      toast.error("Erreur");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cet événement ? Cette action est irréversible.")) return;
    try {
      await deleteEvent(eventId);
      toast.success("Événement supprimé");
      navigate("/events");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  if (!currentEvent) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-200" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to={`/events/${eventId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l'événement
      </Link>

      <h2 className="text-2xl font-bold text-gray-900">Paramètres</h2>

      {/* Event info form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
      >
        <h3 className="text-sm font-semibold text-gray-900">Informations</h3>
        <Input
          id="name"
          label="Nom de l'événement"
          error={errors.name?.message}
          {...register("name")}
        />
        <div>
          <label htmlFor="event_type" className="mb-1 block text-sm font-medium text-gray-700">
            Type
          </label>
          <select
            id="event_type"
            className="w-full min-h-[44px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            {...register("event_type")}
          >
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
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
        <Button type="submit" size="md" isLoading={isSubmitting}>
          <Save className="mr-1.5 h-4 w-4" />
          Enregistrer
        </Button>
      </form>

      {/* Poster */}
      <PosterSection
        event={currentEvent}
        onChange={async () => {
          await fetchEvent(eventId);
        }}
      />

      {/* Members & Admins */}
      <MemberManagement eventId={eventId} />

      <InvitationsManagement
        eventId={eventId}
        organizationLogo={currentEvent.organization_logo}
      />

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="mb-2 text-sm font-semibold text-red-800">Zone de danger</h3>
        <p className="mb-4 text-xs text-red-600">
          La suppression est irréversible. Toutes les tâches, créneaux et inscriptions seront perdus.
        </p>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1.5 h-4 w-4" />
          Supprimer l'événement
        </Button>
      </div>
    </div>
  );
}
