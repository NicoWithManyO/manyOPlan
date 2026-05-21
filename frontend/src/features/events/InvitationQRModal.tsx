import { Copy, Download, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import type { EventInvitation } from "../../types/models";
import { copyToClipboard } from "../../utils/copyToClipboard";

interface Props {
  invitation: EventInvitation;
  onClose: () => void;
}

export function InvitationQRModal({ invitation, onClose }: Props) {
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const url = `${window.location.origin}/invite/${invitation.token}`;
  const fileSlug =
    (invitation.label || invitation.token)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "invite";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDownload = () => {
    const canvas = canvasWrapperRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.error("QR indisponible");
      return;
    }
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `invite-${fileSlug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = () => copyToClipboard(url, "Lien copié");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <h4 className="mb-1 pr-6 text-sm font-semibold text-gray-900">
          {invitation.label || "Sans libellé"}
        </h4>
        <p className="mb-4 text-xs text-gray-500">
          Scannez ou partagez ce QR code pour rejoindre l'événement.
        </p>
        <div
          ref={canvasWrapperRef}
          className="mx-auto mb-4 flex w-fit items-center justify-center rounded-lg border border-gray-200 bg-white p-3"
        >
          <QRCodeCanvas value={url} size={256} level="M" />
        </div>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="mb-4 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleDownload}
            className="flex-1"
          >
            <Download className="mr-1 h-4 w-4" />
            Télécharger (PNG)
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="mr-1 h-4 w-4" />
            Copier le lien
          </Button>
        </div>
      </div>
    </div>
  );
}
