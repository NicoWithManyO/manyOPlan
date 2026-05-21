import { z } from "zod";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const ACCEPTED_IMAGE_TYPES_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

export const imageUrlSchema = z.object({
  url: z
    .string()
    .min(1, "URL requise")
    .max(2048, "URL trop longue")
    .url("URL invalide")
    .refine((v) => v.startsWith("https://"), "L'URL doit commencer par https://"),
});
export type ImageUrlForm = z.infer<typeof imageUrlSchema>;
