import type { InvitationDecoration } from "../../types/models";
import type { QRCenter } from "./InvitationQRModal";

interface InvitationStatusShape {
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
}

export const SLUG_RE = /^[A-Za-z0-9_-]{2,60}$/;

export const DECORATION_LOGO = "logo" as const;
export const DECORATION_TEXT = "text" as const;
export const DECORATION_TEXT_MAX = 15;

export const DEFAULT_DECORATION: InvitationDecoration = {
  decoration_type: DECORATION_LOGO,
  decoration_text: "",
  decoration_bg_color: "#ffffff",
  decoration_text_color: "#000000",
};

export function buildQRCenter(
  decoration: InvitationDecoration,
  logoUrl: string | null,
): QRCenter {
  if (decoration.decoration_type === DECORATION_TEXT) {
    const text = decoration.decoration_text.trim();
    if (!text) return logoUrl ? { kind: "logo", url: logoUrl } : null;
    return {
      kind: "text",
      text,
      bg: decoration.decoration_bg_color,
      fg: decoration.decoration_text_color,
    };
  }
  return logoUrl ? { kind: "logo", url: logoUrl } : null;
}

export function formatDateShort(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isExpired(inv: InvitationStatusShape) {
  if (!inv.expires_at) return false;
  return new Date(inv.expires_at).getTime() < Date.now();
}

export function statusLabel(inv: InvitationStatusShape) {
  if (isExpired(inv)) return { label: "Expirée", className: "bg-gray-100 text-gray-500" };
  if (inv.max_uses != null && inv.use_count >= inv.max_uses) {
    return { label: "Épuisée", className: "bg-gray-100 text-gray-500" };
  }
  if (!inv.is_active) return { label: "Inactive", className: "bg-gray-100 text-gray-600" };
  return { label: "Active", className: "bg-emerald-100 text-emerald-700" };
}

export function isManuallyToggleable(inv: InvitationStatusShape) {
  if (isExpired(inv)) return false;
  if (inv.max_uses != null && inv.use_count >= inv.max_uses) return false;
  return true;
}
