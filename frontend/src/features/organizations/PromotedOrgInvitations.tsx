import { QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import * as orgsApi from "../../api/organizations";
import type { OrganizationInvitation } from "../../types/models";
import { InvitationQRModal } from "../invitations/InvitationQRModal";

interface Props {
  orgId: number;
  organizationLogo: string | null;
}

export function PromotedOrgInvitations({ orgId, organizationLogo }: Props) {
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [qrInvitation, setQrInvitation] = useState<OrganizationInvitation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await orgsApi.getPromotedOrgInvitations(orgId);
        if (!cancelled) setInvitations(data);
      } catch {
        // silently ignore — non-critical UI
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (invitations.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">Rejoindre l'association :</span>
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

      {qrInvitation && (
        <InvitationQRModal
          token={qrInvitation.token}
          label={qrInvitation.label}
          urlPrefix="/asso-invite/"
          description="Scannez ou partagez ce QR code pour rejoindre l'association."
          fileSlugPrefix="asso-invite"
          onClose={() => setQrInvitation(null)}
          logoUrl={organizationLogo}
        />
      )}
    </div>
  );
}
