import { Building2, QrCode, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as orgsApi from "../../api/organizations";
import type { Organization, OrganizationInvitation } from "../../types/models";
import { InvitationQRModal } from "../invitations/InvitationQRModal";

interface Props {
  org: Organization;
}

export function OrgHeaderBand({ org }: Props) {
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [qrInvitation, setQrInvitation] = useState<OrganizationInvitation | null>(null);
  const isAdmin = org.my_role === "admin";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await orgsApi.getPromotedOrgInvitations(org.id);
        if (!cancelled) setInvitations(data);
      } catch {
        // non-critical: hide promoted QR buttons on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org.id]);

  return (
    <>
      <section className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 ring-1 ring-gray-200">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 ring-1 ring-gray-200">
          {org.logo ? (
            <img
              src={org.logo}
              alt={`Logo ${org.name}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <Building2 className="h-7 w-7 text-gray-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-gray-900">
            {org.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {isAdmin && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">
                Admin
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-gray-500">
              <Users className="h-3.5 w-3.5" />
              {org.member_count} membre{org.member_count > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invitations.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => setQrInvitation(inv)}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <QrCode className="h-3.5 w-3.5" />
              QR · {inv.label || "Sans libellé"}
            </button>
          ))}
          {isAdmin && (
            <Link
              to={`/orgs/${org.id}/settings`}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              <Settings className="h-3.5 w-3.5" />
              Paramètres
            </Link>
          )}
        </div>
      </section>

      {qrInvitation && (
        <InvitationQRModal
          token={qrInvitation.token}
          label={qrInvitation.label}
          urlPrefix="/asso-invite/"
          description="Scannez ou partagez ce QR code pour rejoindre l'association."
          fileSlugPrefix="asso-invite"
          onClose={() => setQrInvitation(null)}
          logoUrl={org.logo}
        />
      )}
    </>
  );
}
