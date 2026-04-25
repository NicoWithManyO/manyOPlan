import { Building2, LogOut, UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { cn } from "../../utils/cn";
import { CreateOrgForm } from "./CreateOrgForm";
import { JoinOrgForm } from "./JoinOrgForm";

type Mode = "create" | "join";

export function CreateOrJoinPage() {
  const [mode, setMode] = useState<Mode>("create");
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md ring-1 ring-gray-200">
        <h2 className="mb-2 text-2xl font-bold text-gray-900">
          Bienvenue !
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Pour continuer, créez votre association ou rejoignez-en une avec un code.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "create"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Building2 className="h-4 w-4" />
            Créer
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "join"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <UserPlus className="h-4 w-4" />
            Rejoindre
          </button>
        </div>

        {mode === "create" ? (
          <CreateOrgForm onSuccess={() => navigate("/events")} />
        ) : (
          <JoinOrgForm onSuccess={() => navigate("/events")} />
        )}

        <button
          onClick={logout}
          className="mt-6 inline-flex w-full items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <LogOut className="h-3 w-3" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
