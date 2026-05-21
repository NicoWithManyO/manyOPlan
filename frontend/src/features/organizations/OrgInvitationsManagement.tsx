import {
  Copy,
  Link2,
  Megaphone,
  Plus,
  QrCode,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as orgsApi from "../../api/organizations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { OrganizationInvitation } from "../../types/models";
import { cn } from "../../utils/cn";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { InvitationEditModal } from "../invitations/InvitationEditModal";
import { InvitationQRModal } from "../invitations/InvitationQRModal";
import {
  SLUG_RE,
  formatDateShort,
  isManuallyToggleable,
  statusLabel,
} from "../invitations/utils";

interface Props {
  orgId: number;
  organizationLogo: string | null;
}

export function OrgInvitationsManagement({ orgId, organizationLogo }: Props) {
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [qrInvitation, setQrInvitation] = useState<OrganizationInvitation | null>(null);
  const [editingInvitation, setEditingInvitation] =
    useState<OrganizationInvitation | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgsApi
      .getOrgInvitations(orgId)
      .then((data) => {
        if (!cancelled) setInvitations(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSlugError(null);
    const slug = customSlug.trim();
    if (slug && !SLUG_RE.test(slug)) {
      setSlugError("2-60 caractères : lettres, chiffres, tirets, underscores.");
      return;
    }
    setCreating(true);
    try {
      const created = await orgsApi.createOrgInvitation(orgId, {
        label: label.trim() || undefined,
        token: slug || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_uses: maxUses ? Number(maxUses) : null,
      });
      setInvitations((list) => [created, ...list]);
      toast.success("Invitation créée");
      setLabel("");
      setCustomSlug("");
      setExpiresAt("");
      setMaxUses("");
      setShowForm(false);
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

  const handleDelete = async (inv: OrganizationInvitation) => {
    if (!confirm("Supprimer cette invitation ? Le lien deviendra inutilisable.")) return;
    try {
      await orgsApi.deleteOrgInvitation(orgId, inv.id);
      setInvitations((list) => list.filter((i) => i.id !== inv.id));
      toast.success("Invitation supprimée");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleCopy = (token: string) => {
    copyToClipboard(`${window.location.origin}/asso-invite/${token}`, "Lien copié");
  };

  const handleTogglePromote = async (inv: OrganizationInvitation) => {
    const next = !inv.is_promoted;
    setInvitations((list) =>
      list.map((i) => (i.id === inv.id ? { ...i, is_promoted: next } : i)),
    );
    try {
      await orgsApi.updateOrgInvitation(orgId, inv.id, { is_promoted: next });
      toast.success(next ? "Lien promu" : "Promotion retirée");
    } catch {
      setInvitations((list) =>
        list.map((i) => (i.id === inv.id ? { ...i, is_promoted: !next } : i)),
      );
      toast.error("Erreur");
    }
  };

  const handleToggleActive = async (inv: OrganizationInvitation) => {
    const next = !inv.is_active;
    const message = next
      ? "Réactiver ce lien ? Il redeviendra utilisable."
      : "Désactiver ce lien ? Il ne sera plus utilisable.";
    if (!confirm(message)) return;
    setInvitations((list) =>
      list.map((i) => (i.id === inv.id ? { ...i, is_active: next } : i)),
    );
    try {
      await orgsApi.updateOrgInvitation(orgId, inv.id, { is_active: next });
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
        l'association.
      </p>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3"
        >
          <Input
            id="org_inv_label"
            label="Libellé (optionnel)"
            placeholder="Ex : Nouveaux membres 2026"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div>
            <Input
              id="org_inv_slug"
              label="Lien personnalisé (optionnel)"
              placeholder="Ex : asso2026"
              value={customSlug}
              onChange={(e) => {
                setCustomSlug(e.target.value);
                if (slugError) setSlugError(null);
              }}
              error={slugError ?? undefined}
            />
            <p className="mt-1 text-xs text-gray-500">
              Donne une URL mémorisable :{" "}
              <code className="rounded bg-gray-100 px-1">
                /asso-invite/{customSlug || "ton-lien"}
              </code>
              . Vide → généré automatiquement.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              id="org_inv_expires_at"
              label="Expiration (optionnel)"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <Input
              id="org_inv_max_uses"
              label="Nb max d'utilisations (optionnel)"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
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
            const url = `${window.location.origin}/asso-invite/${inv.token}`;
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
                            ? "Lien visible par tous les membres dans l'association"
                            : "Rendre ce lien visible par tous les membres"
                        }
                      >
                        <Megaphone className="h-3 w-3" />
                        {inv.is_promoted ? "Promu" : "Promouvoir"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {inv.use_count}
                      {inv.max_uses != null ? ` / ${inv.max_uses}` : ""} utilisation
                      {inv.use_count > 1 ? "s" : ""}
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
          urlPrefix="/asso-invite/"
          description="Scannez ou partagez ce QR code pour rejoindre l'association."
          fileSlugPrefix="asso-invite"
          onClose={() => setQrInvitation(null)}
          logoUrl={organizationLogo}
        />
      )}

      {editingInvitation && (
        <InvitationEditModal
          invitation={editingInvitation}
          onClose={() => setEditingInvitation(null)}
          onSave={(label) =>
            orgsApi.updateOrgInvitation(orgId, editingInvitation.id, { label })
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
