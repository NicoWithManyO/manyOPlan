import { Building2 } from "lucide-react";
import { cn } from "../utils/cn";

type Size = "md" | "lg";

const SIZES: Record<Size, { box: string; icon: string }> = {
  md: { box: "h-14 w-14", icon: "h-7 w-7" },
  lg: { box: "h-24 w-24", icon: "h-10 w-10" },
};

interface Props {
  src: string | null | undefined;
  alt: string;
  size?: Size;
  className?: string;
}

export function OrgLogoBox({ src, alt, size = "md", className }: Props) {
  const { box, icon } = SIZES[size];
  return (
    <div
      className={cn(
        box,
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 ring-1 ring-gray-200",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <Building2 className={cn(icon, "text-gray-300")} />
      )}
    </div>
  );
}
