import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as eventsApi from "../../api/events";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { EventInvitation } from "../../types/models";
import { pickApiError } from "../../utils/handleApiError";

interface Props {
  eventId: number;
  invitation: EventInvitation;
  onClose: () => void;
  onSaved: (updated: EventInvitation) => void;
}

export function InvitationEditModal({ eventId, invitation, onClose, onSaved }: Props) {
  const [label, setLabel] = useState(invitation.label);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = label.trim();
    if (next === invitation.label) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const updated = await eventsApi.updateEventInvitation(eventId, invitation.id, {
        label: next,
      });
      toast.success("Libellé mis à jour");
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
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
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
          Modifier le lien
        </h4>
        <Input
          ref={inputRef}
          id="edit_inv_label"
          label="Libellé"
          placeholder="Ex : Bénévoles ouverture"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={100}
        />
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
