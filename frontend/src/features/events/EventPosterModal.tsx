import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function EventPosterModal({ src, alt = "", onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[95vh] max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 rounded-full bg-white p-1.5 text-gray-700 shadow hover:bg-gray-100"
          title="Fermer"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <img
          src={src}
          alt={alt}
          className="max-h-[95vh] max-w-full rounded object-contain shadow-2xl"
        />
      </div>
    </div>,
    document.body,
  );
}
