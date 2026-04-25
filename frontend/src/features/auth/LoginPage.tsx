import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuthStore } from "../../stores/authStore";

const schema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data);
    } catch {
      setError("root", {
        message: "Identifiants incorrects",
      });
    }
  };

  return (
    <>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Connexion</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errors.root && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {errors.root.message}
          </div>
        )}
        <Input
          id="username"
          label="Nom d'utilisateur"
          autoComplete="username"
          error={errors.username?.message}
          {...register("username")}
        />
        <Input
          id="password"
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Se connecter
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Pas encore de compte ?{" "}
        <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
          S'inscrire
        </Link>
      </p>
    </>
  );
}
