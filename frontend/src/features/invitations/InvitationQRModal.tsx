import { Copy, Download, X } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { copyToClipboard } from "../../utils/copyToClipboard";

const QR_SIZE = 256;
const QR_LOGO_SIZE = Math.round(QR_SIZE * 0.18);
const QR_TEXT_SIZE = Math.round(QR_SIZE * 0.22);

export type QRCenter =
  | { kind: "logo"; url: string }
  | { kind: "text"; text: string; bg: string; fg: string }
  | null;

interface Props {
  token: string;
  label?: string;
  urlPrefix?: string;
  description?: string;
  fileSlugPrefix?: string;
  onClose: () => void;
  center: QRCenter;
}

function buildTextDecorationDataUrl(
  text: string,
  bg: string,
  fg: string,
  size: number,
): string | null {
  if (!text) return null;
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const padding = canvas.width * 0.08;
  const maxWidth = canvas.width - padding * 2;
  const maxHeight = canvas.height - padding * 2;
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let fontSize = canvas.height * 0.7;
  for (let i = 0; i < 12; i++) {
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(text);
    const height =
      (metrics.actualBoundingBoxAscent || fontSize * 0.7) +
      (metrics.actualBoundingBoxDescent || fontSize * 0.2);
    if (metrics.width <= maxWidth && height <= maxHeight) break;
    fontSize *= 0.85;
  }
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

function buildImageSettings(center: QRCenter, textDataUrl: string | null) {
  if (!center) return undefined;
  if (center.kind === "logo") {
    return {
      src: center.url,
      height: QR_LOGO_SIZE,
      width: QR_LOGO_SIZE,
      excavate: true,
      crossOrigin: "anonymous" as const,
    };
  }
  if (!textDataUrl) return undefined;
  return {
    src: textDataUrl,
    height: QR_TEXT_SIZE,
    width: QR_TEXT_SIZE,
    excavate: true,
  };
}

export function InvitationQRModal({
  token,
  label,
  urlPrefix = "/invite/",
  description = "Scannez ou partagez ce QR code pour rejoindre l'événement.",
  fileSlugPrefix = "invite",
  onClose,
  center,
}: Props) {
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const url = `${window.location.origin}${urlPrefix}${token}`;
  const fileSlug =
    (label || token)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || fileSlugPrefix;

  const textDataUrl =
    center?.kind === "text"
      ? buildTextDecorationDataUrl(center.text, center.bg, center.fg, QR_TEXT_SIZE)
      : null;
  const imageSettings = buildImageSettings(center, textDataUrl);
  const errorLevel: "L" | "M" | "Q" | "H" = imageSettings ? "H" : "M";

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
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch {
      toast.error("QR indisponible");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${fileSlugPrefix}-${fileSlug}.png`;
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
          {label || "Sans libellé"}
        </h4>
        <p className="mb-4 text-xs text-gray-500">{description}</p>
        <div
          ref={canvasWrapperRef}
          className="mx-auto mb-4 flex w-fit items-center justify-center rounded-lg border border-gray-200 bg-white p-3"
        >
          <QRCodeCanvas
            value={url}
            size={QR_SIZE}
            level={errorLevel}
            imageSettings={imageSettings}
          />
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
