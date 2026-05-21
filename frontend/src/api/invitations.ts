import type {
  InvitationAcceptResponse,
  InvitationAcceptSignup,
  InvitationPreview,
  OrgInvitationAcceptResponse,
  OrgInvitationPreview,
} from "../types/models";
import client from "./client";

export async function getInvitationPreview(token: string) {
  const res = await client.get<InvitationPreview>(`/invitations/${token}/`);
  return res.data;
}

export async function acceptInvitation(
  token: string,
  signupData?: InvitationAcceptSignup,
) {
  const res = await client.post<InvitationAcceptResponse>(
    `/invitations/${token}/accept/`,
    signupData ?? {},
  );
  return res.data;
}

export async function getOrgInvitationPreview(token: string) {
  const res = await client.get<OrgInvitationPreview>(`/asso-invitations/${token}/`);
  return res.data;
}

export async function acceptOrgInvitation(
  token: string,
  signupData?: InvitationAcceptSignup,
) {
  const res = await client.post<OrgInvitationAcceptResponse>(
    `/asso-invitations/${token}/accept/`,
    signupData ?? {},
  );
  return res.data;
}
