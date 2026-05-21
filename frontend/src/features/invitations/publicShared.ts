import { useEffect, useRef, useState } from "react";

export function invalidReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "expired":
      return "Cette invitation a expiré.";
    case "exhausted":
      return "Cette invitation a atteint sa limite d'utilisations.";
    case "inactive":
      return "Cette invitation a été désactivée.";
    default:
      return "Cette invitation n'est plus valide.";
  }
}

interface PreviewResult<T> {
  loading: boolean;
  preview: T | null;
  loadError: string | null;
}

export function useInvitationPreview<T>(
  token: string | undefined,
  fetcher: (token: string) => Promise<T>,
): PreviewResult<T> {
  const [preview, setPreview] = useState<T | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep the latest fetcher in a ref so unstable references (inline arrows)
  // don't re-trigger the fetch on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!token) {
      setLoadError("Lien invalide.");
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const data = await fetcherRef.current(token);
        if (!ctrl.signal.aborted) setPreview(data);
      } catch (err: unknown) {
        if (ctrl.signal.aborted) return;
        const error = err as { response?: { status?: number } };
        setLoadError(
          error.response?.status === 404
            ? "Invitation introuvable."
            : "Impossible de charger l'invitation.",
        );
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [token]);

  return { loading, preview, loadError };
}
