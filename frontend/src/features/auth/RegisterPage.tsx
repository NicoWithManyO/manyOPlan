import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Sparkles, UserPlus } from "lucide-react";
import { useState } from "react";
import {
  useForm,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
  type UseFormSetError,
} from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuthStore } from "../../stores/authStore";
import { useOrgStore } from "../../stores/orgStore";
import { cn } from "../../utils/cn";

type Mode = "create_org" | "join_org";

const baseSchema = z
  .object({
    email: z.string().email("Email invalide"),
    first_name: z.string().min(1, "Prénom requis"),
    last_name: z.string().min(1, "Nom requis"),
    nickname: z.string().max(60, "60 caractères maximum").optional(),
    password: z.string().min(8, "8 caractères minimum"),
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["password_confirm"],
  });

const inviteCodeRegex = /^[A-Za-z0-9_-]{4,32}$/;

const createOrgSchema = baseSchema.and(
  z.object({
    org_name: z.string().min(1, "Nom requis").max(120),
    invite_code: z
      .string()
      .regex(
        inviteCodeRegex,
        "4-32 caractères : lettres, chiffres, tirets, underscores",
      ),
  }),
);

const joinOrgSchema = baseSchema.and(
  z.object({
    invite_code: z
      .string()
      .regex(inviteCodeRegex, "Format de code invalide"),
  }),
);

type CreateFormData = z.infer<typeof createOrgSchema>;
type JoinFormData = z.infer<typeof joinOrgSchema>;

function generateRandomCode(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function RegisterPage() {
  const [mode, setMode] = useState<Mode>("create_org");
  const navigate = useNavigate();
  const registerWithResponse = useAuthStore((s) => s.registerWithResponse);
  const setCurrentOrg = useOrgStore((s) => s.setCurrentOrg);
  const isLoading = useAuthStore((s) => s.isLoading);

  return (
    <>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">Inscription</h2>
      <p className="mb-6 text-sm text-gray-500">
        Créez votre association ou rejoignez-en une existante.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setMode("create_org")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
            mode === "create_org"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          <Building2 className="h-4 w-4" />
          Créer
        </button>
        <button
          type="button"
          onClick={() => setMode("join_org")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
            mode === "join_org"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          <UserPlus className="h-4 w-4" />
          Rejoindre
        </button>
      </div>

      {mode === "create_org" ? (
        <CreateOrgForm
          onSuccess={async (org) => {
            setCurrentOrg(org);
            navigate("/events");
          }}
          isLoading={isLoading}
          submit={registerWithResponse}
        />
      ) : (
        <JoinOrgForm
          onSuccess={async (org) => {
            setCurrentOrg(org);
            navigate("/events");
          }}
          isLoading={isLoading}
          submit={registerWithResponse}
        />
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Se connecter
        </Link>
      </p>
    </>
  );
}

interface SubmitFn {
  (data: import("../../types/models").RegisterData): Promise<
    import("../../types/models").RegisterResponse
  >;
}

function CreateOrgForm({
  onSuccess,
  isLoading,
  submit,
}: {
  onSuccess: (org: import("../../types/models").Organization) => void;
  isLoading: boolean;
  submit: SubmitFn;
}) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<CreateFormData>({ resolver: zodResolver(createOrgSchema) });

  const onSubmit = async (data: CreateFormData) => {
    try {
      const response = await submit({
        email: data.email,
        password: data.password,
        password_confirm: data.password_confirm,
        first_name: data.first_name,
        last_name: data.last_name,
        nickname: data.nickname?.trim() || undefined,
        action: "create_org",
        org: {
          name: data.org_name,
          invite_code: data.invite_code,
        },
      });
      if (response.organization) onSuccess(response.organization);
    } catch (err: unknown) {
      handleApiError(err, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PersonalFields register={register} errors={errors} />
      <hr className="border-gray-200" />
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Building2 className="h-4 w-4" />
        Mon association
      </h3>
      <Input
        id="org_name"
        label="Nom de l'association"
        error={errors.org_name?.message}
        {...register("org_name")}
      />
      <div>
        <Input
          id="invite_code"
          label="Code d'invitation pour mes bénévoles"
          error={errors.invite_code?.message}
          {...register("invite_code")}
        />
        <button
          type="button"
          onClick={() => setValue("invite_code", generateRandomCode(), { shouldValidate: true })}
          className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500"
        >
          <Sparkles className="h-3 w-3" />
          Générer un code aléatoire
        </button>
      </div>
      {errors.root && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}
      <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
        Créer mon compte et mon association
      </Button>
    </form>
  );
}

function JoinOrgForm({
  onSuccess,
  isLoading,
  submit,
}: {
  onSuccess: (org: import("../../types/models").Organization) => void;
  isLoading: boolean;
  submit: SubmitFn;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<JoinFormData>({ resolver: zodResolver(joinOrgSchema) });

  const onSubmit = async (data: JoinFormData) => {
    try {
      const response = await submit({
        email: data.email,
        password: data.password,
        password_confirm: data.password_confirm,
        first_name: data.first_name,
        last_name: data.last_name,
        nickname: data.nickname?.trim() || undefined,
        action: "join_org",
        invite_code: data.invite_code,
      });
      if (response.organization) onSuccess(response.organization);
    } catch (err: unknown) {
      handleApiError(err, setError);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PersonalFields register={register} errors={errors} />
      <hr className="border-gray-200" />
      <Input
        id="invite_code"
        label="Code d'invitation reçu"
        placeholder="Demandez le code à l'admin de votre association"
        error={errors.invite_code?.message}
        {...register("invite_code")}
      />
      {errors.root && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}
      <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
        Créer mon compte et rejoindre
      </Button>
    </form>
  );
}

type PersonalFormFields = {
  first_name: string;
  last_name: string;
  nickname?: string;
  email: string;
  password: string;
  password_confirm: string;
};

function PersonalFields<T extends PersonalFormFields>({
  register,
  errors,
}: {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}) {
  const errs = errors as FieldErrors<PersonalFormFields>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input
          id="first_name"
          label="Prénom"
          autoComplete="given-name"
          error={errs.first_name?.message}
          {...register("first_name" as Path<T>)}
        />
        <Input
          id="last_name"
          label="Nom"
          autoComplete="family-name"
          error={errs.last_name?.message}
          {...register("last_name" as Path<T>)}
        />
      </div>
      <div>
        <Input
          id="nickname"
          label="Surnom (optionnel)"
          autoComplete="nickname"
          placeholder="Ex : Niko"
          error={errs.nickname?.message}
          {...register("nickname" as Path<T>)}
        />
        <p className="mt-1 text-xs text-gray-500">
          Affiché dans les plannings. Vide → « Prénom L. ».
        </p>
      </div>
      <Input
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errs.email?.message}
        {...register("email" as Path<T>)}
      />
      <Input
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        error={errs.password?.message}
        {...register("password" as Path<T>)}
      />
      <Input
        id="password_confirm"
        label="Confirmer"
        type="password"
        autoComplete="new-password"
        error={errs.password_confirm?.message}
        {...register("password_confirm" as Path<T>)}
      />
    </>
  );
}

function handleApiError<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
) {
  const error = err as { response?: { data?: Record<string, unknown> } };
  const data = error.response?.data;
  if (!data) {
    setError("root", { message: "Erreur lors de l'inscription" });
    return;
  }
  // Top-level field errors
  for (const [field, msg] of Object.entries(data)) {
    if (Array.isArray(msg)) {
      setError(field as Path<T>, { message: String(msg[0]) });
    } else if (typeof msg === "object" && msg !== null) {
      // Nested errors (e.g. org.invite_code)
      for (const [nested, nestedMsg] of Object.entries(msg as Record<string, unknown>)) {
        const arr = Array.isArray(nestedMsg) ? nestedMsg : [nestedMsg];
        const targetField = field === "org" && nested === "invite_code" ? "invite_code" : nested;
        setError(targetField as Path<T>, { message: String(arr[0]) });
      }
    } else {
      setError(field as Path<T>, { message: String(msg) });
    }
  }
}
