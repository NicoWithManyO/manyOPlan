import { toast } from "sonner";

export async function copyToClipboard(text: string, successMessage = "Copié") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error("Impossible de copier");
    return false;
  }
}
