import { cn } from "../utils/cn";

export function OrgLogo({
  src,
  className,
}: {
  src: string | null | undefined;
  className: string;
}) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn(className, "shrink-0 object-contain")}
    />
  );
}
