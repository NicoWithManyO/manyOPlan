import { z } from "zod";
import { privacyConsentField } from "./PrivacyConsent";

export const signupSchema = z
  .object({
    email: z.string().email("Email invalide"),
    first_name: z.string().min(1, "Prénom requis"),
    last_name: z.string().min(1, "Nom requis"),
    nickname: z.string().max(60, "60 caractères maximum").optional(),
    password: z.string().min(8, "8 caractères minimum"),
    password_confirm: z.string(),
    ...privacyConsentField,
  })
  .refine((d) => d.password === d.password_confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["password_confirm"],
  });

export type SignupFormData = z.infer<typeof signupSchema>;
