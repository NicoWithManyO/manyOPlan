import type { FieldErrors, Path, UseFormRegister } from "react-hook-form";
import { Input } from "../../components/ui/Input";

export type PersonalFormFields = {
  first_name: string;
  last_name: string;
  nickname?: string;
  email: string;
  password: string;
  password_confirm: string;
};

export function PersonalFields<T extends PersonalFormFields>({
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
