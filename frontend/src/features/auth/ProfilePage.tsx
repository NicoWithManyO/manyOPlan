import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { changePassword, deleteMyAccount, exportMyData } from "../../api/account";
import { updateMe } from "../../api/auth";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuthStore } from "../../stores/authStore";
import { pickApiError } from "../../utils/handleApiError";

const profileSchema = z.object({
  username: z.string().min(3, "3 caractères minimum"),
  first_name: z.string().min(1, "Prénom requis"),
  last_name: z.string(),
  nickname: z.string().max(60, "60 caractères maximum"),
  email: z.string().email("Email invalide"),
});

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Requis"),
    new_password: z.string().min(8, "8 caractères minimum"),
    new_password_confirm: z.string(),
  })
  .refine((d) => d.new_password === d.new_password_confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["new_password_confirm"],
  });

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user, fetchUser, logout } = useAuthStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `manyoplan-mes-donnees-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePassword) {
      toast.error("Mot de passe requis");
      return;
    }
    setDeleting(true);
    try {
      await deleteMyAccount(deletePassword);
      toast.success("Compte supprimé");
      await logout();
    } catch (err: unknown) {
      const fieldErr = (err as { response?: { data?: { password?: string[] } } })
        .response?.data?.password?.[0];
      toast.error(fieldErr ?? pickApiError(err, "Erreur lors de la suppression"));
    } finally {
      setDeleting(false);
    }
  };

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username ?? "",
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      nickname: user?.nickname ?? "",
      email: user?.email ?? "",
    },
  });

  const {
    register: regPassword,
    handleSubmit: handlePassword,
    reset: resetPassword,
    formState: { errors: pwErrors, isSubmitting: pwSubmitting },
    setError: setPwError,
  } = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = async (data: ProfileData) => {
    try {
      await updateMe(data);
      await fetchUser();
      toast.success("Profil mis à jour");
    } catch {
      toast.error("Erreur");
    }
  };

  const onPasswordSubmit = async (data: PasswordData) => {
    try {
      await changePassword(data);
      toast.success("Mot de passe modifié");
      resetPassword();
    } catch (err: unknown) {
      const error = err as { response?: { data?: Record<string, string[]> } };
      if (error.response?.data?.old_password) {
        setPwError("old_password", { message: error.response.data.old_password[0] });
      } else {
        toast.error("Erreur");
      }
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Mon profil</h2>

      {/* Profile info */}
      <form
        onSubmit={handleProfile(onProfileSubmit)}
        className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-4"
      >
        <h3 className="text-sm font-semibold text-gray-900">Informations</h3>
        <Input
          id="username"
          label="Nom d'utilisateur (identifiant de connexion)"
          error={profileErrors.username?.message}
          {...regProfile("username")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="first_name"
            label="Prénom"
            error={profileErrors.first_name?.message}
            {...regProfile("first_name")}
          />
          <Input
            id="last_name"
            label="Nom"
            error={profileErrors.last_name?.message}
            {...regProfile("last_name")}
          />
        </div>
        <div>
          <Input
            id="nickname"
            label="Surnom (affiché dans les plannings)"
            placeholder={user?.first_name ? `Ex : ${user.first_name}` : "Ex : Léo"}
            error={profileErrors.nickname?.message}
            {...regProfile("nickname")}
          />
          <p className="mt-1 text-xs text-gray-500">
            Si vide, on affiche « Prénom L. » (initiale du nom).
          </p>
        </div>
        <Input
          id="email"
          label="Email"
          type="email"
          error={profileErrors.email?.message}
          {...regProfile("email")}
        />
        <div className="text-xs text-gray-500">
          Nom d'utilisateur : <span className="font-medium">{user?.username}</span>
        </div>
        <Button type="submit" size="sm" isLoading={profileSubmitting}>
          <Save className="mr-1.5 h-4 w-4" />
          Enregistrer
        </Button>
      </form>

      {/* Change password */}
      <form
        onSubmit={handlePassword(onPasswordSubmit)}
        className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-4"
      >
        <h3 className="text-sm font-semibold text-gray-900">
          Changer le mot de passe
        </h3>
        <Input
          id="old_password"
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          error={pwErrors.old_password?.message}
          {...regPassword("old_password")}
        />
        <Input
          id="new_password"
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          error={pwErrors.new_password?.message}
          {...regPassword("new_password")}
        />
        <Input
          id="new_password_confirm"
          label="Confirmer"
          type="password"
          autoComplete="new-password"
          error={pwErrors.new_password_confirm?.message}
          {...regPassword("new_password_confirm")}
        />
        <Button type="submit" size="sm" variant="secondary" isLoading={pwSubmitting}>
          Changer le mot de passe
        </Button>
      </form>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Mes données (RGPD)</h3>
          <p className="mt-1 text-xs text-gray-500">
            Téléchargez toutes vos données personnelles au format JSON.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          isLoading={exporting}
          onClick={handleExport}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Exporter mes données
        </Button>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-red-200 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-red-700">Supprimer mon compte</h3>
          <p className="mt-1 text-xs text-gray-500">
            Votre profil sera anonymisé (nom, email, surnom remplacés) et votre
            compte désactivé. L'historique des plannings est conservé sans vous
            identifier.
          </p>
        </div>
        {!confirmDelete ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setConfirmDelete(true)}
            className="text-red-700 hover:bg-red-50"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Supprimer mon compte
          </Button>
        ) : (
          <div className="space-y-3">
            <Input
              id="delete_password"
              label="Confirmez avec votre mot de passe"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeletePassword("");
                }}
              >
                Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                isLoading={deleting}
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Confirmer la suppression
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
