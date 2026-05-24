import {
  Copy,
  ExternalLink,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as orgsApi from "../../api/organizations";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useOrgStore } from "../../stores/orgStore";
import type {
  ExternalQRCode,
  InvitationDecoration,
} from "../../types/models";
import { copyToClipboard } from "../../utils/copyToClipboard";
import { pickApiError } from "../../utils/handleApiError";
import { InvitationDecorationPicker } from "../invitations/InvitationDecorationPicker";
import { InvitationQRModal } from "../invitations/InvitationQRModal";
import {
  DECORATION_TEXT,
  DEFAULT_DECORATION,
  buildQRCenter,
  formatDateShort,
} from "../invitations/utils";

function parseExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

interface EditModalProps {
  qr: ExternalQRCode;
  orgId: number;
  organizationLogo: string | null;
  onClose: () => void;
  onSaved: (updated: ExternalQRCode) => void;
}

function ExternalQREditModal({
  qr,
  orgId,
  organizationLogo,
  onClose,
  onSaved,
}: EditModalProps) {
  const [label, setLabel] = useState(qr.label);
  const [targetUrl, setTargetUrl] = useState(qr.target_url);
  const [decoration, setDecoration] = useState<InvitationDecoration>({
    decoration_type: qr.decoration_type,
    decoration_text: qr.decoration_text,
    decoration_bg_color: qr.decoration_bg_color,
    decoration_text_color: qr.decoration_text_color,
  });
  const [urlError, setUrlError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    const url = parseExternalUrl(targetUrl);
    if (!url) {
      setUrlError("URL invalide. Saisis une adresse http(s).");
      return;
    }
    const decorationText = decoration.decoration_text.trim();
    if (decoration.decoration_type === DECORATION_TEXT && !decorationText) {
      toast.error("Saisis un texte ou choisis le logo.");
      return;
    }
    setSaving(true);
    try {
      const updated = await orgsApi.updateOrgExternalQR(orgId, qr.id, {
        label: label.trim(),
        target_url: url,
        decoration_type: decoration.decoration_type,
        decoration_text: decorationText,
        decoration_bg_color: decoration.decoration_bg_color,
        decoration_text_color: decoration.decoration_text_color,
      });
      toast.success("QR mis à jour");
      onSaved(updated);
    } catch (err) {
      toast.error(pickApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <h4 className="mb-4 pr-6 text-sm font-semibold text-gray-900">
          Modifier le QR code
        </h4>
        <div className="space-y-3">
          <Input
            id="edit_qr_label"
            label="Libellé (optionnel)"
            placeholder="Ex : Site web"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={100}
          />
          <Input
            id="edit_qr_url"
            label="URL cible"
            placeholder="https://exemple.com"
            type="url"
            value={targetUrl}
            onChange={(e) => {
              setTargetUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            error={urlError ?? undefined}
          />
          <InvitationDecorationPicker
            value={decoration}
            onChange={setDecoration}
            hasOrgLogo={!!organizationLogo}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" size="sm" isLoading={saving}>
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}

export function OrgExternalQRsPage() {
  const { currentOrg } = useOrgStore();

  const [qrs, setQrs] = useState<ExternalQRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [decoration, setDecoration] =
    useState<InvitationDecoration>(DEFAULT_DECORATION);
  const [qrToShow, setQrToShow] = useState<ExternalQRCode | null>(null);
  const [editing, setEditing] = useState<ExternalQRCode | null>(null);

  const orgId = currentOrg?.id;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    orgsApi
      .getOrgExternalQRs(orgId)
      .then((data) => {
        if (!cancelled) setQrs(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (!currentOrg) {
    return (
      <p className="text-sm text-gray-500">
        Sélectionnez une association pour gérer ses QR codes.
      </p>
    );
  }

  const resetForm = () => {
    setLabel("");
    setTargetUrl("");
    setUrlError(null);
    setDecoration(DEFAULT_DECORATION);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    const url = parseExternalUrl(targetUrl);
    if (!url) {
      setUrlError("URL invalide. Saisis une adresse http(s).");
      return;
    }
    const decorationText = decoration.decoration_text.trim();
    if (decoration.decoration_type === DECORATION_TEXT && !decorationText) {
      toast.error("Saisis un texte ou choisis le logo.");
      return;
    }
    setCreating(true);
    try {
      const created = await orgsApi.createOrgExternalQR(currentOrg.id, {
        label: label.trim() || undefined,
        target_url: url,
        decoration_type: decoration.decoration_type,
        decoration_text: decorationText,
        decoration_bg_color: decoration.decoration_bg_color,
        decoration_text_color: decoration.decoration_text_color,
      });
      setQrs((list) => [created, ...list]);
      toast.success("QR créé");
      resetForm();
      setShowForm(false);
    } catch (err) {
      toast.error(pickApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (qr: ExternalQRCode) => {
    if (!confirm("Supprimer ce QR code ?")) return;
    try {
      await orgsApi.deleteOrgExternalQR(currentOrg.id, qr.id);
      setQrs((list) => list.filter((q) => q.id !== qr.id));
      toast.success("QR supprimé");
    } catch (err) {
      toast.error(pickApiError(err));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">QR codes</h2>
        {!showForm && (
          <Button size="md" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Créer
          </Button>
        )}
      </div>

      <p className="mb-4 text-sm text-gray-500">
        Génère un QR code décoré aux couleurs de l'asso vers n'importe quelle URL
        externe (site, billetterie, page Facebook, etc.). Visibles et modifiables
        par tous les membres de l'association.
      </p>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4"
        >
          <Input
            id="qr_label"
            label="Libellé (optionnel)"
            placeholder="Ex : Site web, Billetterie 2026..."
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={100}
          />
          <Input
            id="qr_url"
            label="URL cible"
            placeholder="https://tinyurl.com/lesnuitsnomades"
            type="url"
            value={targetUrl}
            onChange={(e) => {
              setTargetUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            error={urlError ?? undefined}
          />
          <InvitationDecorationPicker
            value={decoration}
            onChange={setDecoration}
            hasOrgLogo={!!currentOrg.logo}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={creating}>
              Créer le QR
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Annuler
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      ) : qrs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <QrCode className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            Aucun QR code pour le moment.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {qrs.map((qr) => (
            <li
              key={qr.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {qr.label || "Sans libellé"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Créé le {formatDateShort(qr.created_at)}
                    {qr.created_by ? ` par ${qr.created_by.username}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(qr)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(qr)}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={qr.target_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 flex-1 items-center gap-1 truncate rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-indigo-700 hover:underline"
                  title={qr.target_url}
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{qr.target_url}</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(qr.target_url, "URL copiée")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copier
                </button>
                <button
                  type="button"
                  onClick={() => setQrToShow(qr)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                  title="Afficher le QR code"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Voir QR
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {qrToShow && (
        <InvitationQRModal
          token={String(qrToShow.id)}
          urlOverride={qrToShow.target_url}
          label={qrToShow.label}
          description="Scannez ou partagez ce QR code."
          fileSlugPrefix="qr"
          onClose={() => setQrToShow(null)}
          center={buildQRCenter(qrToShow, currentOrg.logo)}
        />
      )}

      {editing && (
        <ExternalQREditModal
          qr={editing}
          orgId={currentOrg.id}
          organizationLogo={currentOrg.logo}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setQrs((list) =>
              list.map((q) => (q.id === updated.id ? updated : q)),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
