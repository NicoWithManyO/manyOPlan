import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

type NestedFieldMap = Record<string, string>;

export function handleApiError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  options: { fallbackMessage?: string; nestedFieldMap?: NestedFieldMap } = {},
) {
  const error = err as { response?: { data?: Record<string, unknown> } };
  const data = error.response?.data;
  const fallback = options.fallbackMessage ?? "Une erreur est survenue.";
  if (!data) {
    setError("root", { message: fallback });
    return;
  }
  for (const [field, msg] of Object.entries(data)) {
    if (Array.isArray(msg)) {
      setError(field as Path<T>, { message: String(msg[0]) });
    } else if (typeof msg === "object" && msg !== null) {
      for (const [nested, nestedMsg] of Object.entries(msg as Record<string, unknown>)) {
        const arr = Array.isArray(nestedMsg) ? nestedMsg : [nestedMsg];
        const key = `${field}.${nested}`;
        const targetField = options.nestedFieldMap?.[key] ?? nested;
        setError(targetField as Path<T>, { message: String(arr[0]) });
      }
    } else {
      setError(field as Path<T>, { message: String(msg) });
    }
  }
}
