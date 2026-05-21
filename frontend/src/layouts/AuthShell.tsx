import type { ReactNode } from "react";
import { PrivacyFooter } from "../components/shared/PrivacyFooter";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">ManyOPlan</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gestion de bénévoles simplifiée
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          {children}
        </div>
        <PrivacyFooter className="mt-6 text-center text-xs text-gray-500" />
      </div>
    </div>
  );
}
