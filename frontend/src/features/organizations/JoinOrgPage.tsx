import { ArrowLeft, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { JoinOrgForm } from "./JoinOrgForm";

export function JoinOrgPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md">
      <Link
        to="/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <UserPlus className="h-6 w-6 text-indigo-600" />
          Rejoindre une association
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Demandez le code d'invitation à l'admin de l'association.
        </p>
        <JoinOrgForm onSuccess={() => navigate("/events")} />
      </div>
    </div>
  );
}
