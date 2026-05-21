import { cn } from "../utils/cn";

interface Props {
  src: string | null | undefined;
  className: string;
  alt?: string;
  onClick?: () => void;
}

export function EventPoster({ src, className, alt = "", onClick }: Props) {
  if (!src) return null;
  const img = (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn(className, "shrink-0 object-cover")}
    />
  );
  if (!onClick) return img;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="shrink-0 cursor-zoom-in"
      aria-label="Agrandir l'affiche"
    >
      {img}
    </button>
  );
}
