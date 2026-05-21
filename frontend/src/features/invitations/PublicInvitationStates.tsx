import { Link } from "react-router-dom";
import { AuthShell } from "../../layouts/AuthShell";

export function InvitationErrorState({ message }: { message: string }) {
  return (
    <AuthShell>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">Invitation</h2>
      <p className="mb-4 text-sm text-red-700">{message}</p>
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
        Retour à l'accueil
      </Link>
    </AuthShell>
  );
}

export function InvitationLoadingState() {
  return (
    <AuthShell>
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    </AuthShell>
  );
}
