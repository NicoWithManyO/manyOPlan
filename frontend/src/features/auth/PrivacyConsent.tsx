import type { UseFormRegisterReturn } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

export const privacyConsentField = {
  privacy_consent: z.literal(true, {
    errorMap: () => ({
      message: "Vous devez accepter la politique de confidentialité.",
    }),
  }),
};

export function PrivacyConsent({
  id = "privacy_consent",
  register,
  error,
}: {
  id?: string;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-start gap-2 text-sm text-gray-700"
      >
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          {...register}
        />
        <span>
          J'accepte la{" "}
          <Link
            to="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            politique de confidentialité
          </Link>
          .
        </span>
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
