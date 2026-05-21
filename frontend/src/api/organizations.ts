import type { Organization, OrganizationMembership } from "../types/models";
import client from "./client";

export async function getMyOrgs() {
  const res = await client.get<Organization[]>("/organizations/me/");
  return res.data;
}

export async function getOrg(id: number) {
  const res = await client.get<Organization>(`/organizations/${id}/`);
  return res.data;
}

export async function createOrg(data: { name: string; slug?: string; invite_code: string }) {
  const res = await client.post<Organization>("/organizations/", data);
  return res.data;
}

export async function updateOrg(
  id: number,
  data: Partial<{ name: string; slug: string; invite_code: string }>,
) {
  const res = await client.patch<Organization>(`/organizations/${id}/`, data);
  return res.data;
}

export async function joinOrg(invite_code: string) {
  const res = await client.post<Organization>("/organizations/join/", { invite_code });
  return res.data;
}

export async function leaveOrg(id: number) {
  await client.post(`/organizations/${id}/leave/`);
}

export async function regenerateCode(id: number) {
  const res = await client.post<{ invite_code: string }>(
    `/organizations/${id}/regenerate-code/`,
  );
  return res.data;
}

export async function getMembers(id: number) {
  const res = await client.get<OrganizationMembership[]>(
    `/organizations/${id}/members/`,
  );
  return res.data;
}

export async function memberAction(
  orgId: number,
  userId: number,
  action: "promote" | "demote",
) {
  const res = await client.post<OrganizationMembership>(
    `/organizations/${orgId}/members/${userId}/`,
    { action },
  );
  return res.data;
}

export async function kickMember(orgId: number, userId: number) {
  await client.delete(`/organizations/${orgId}/members/${userId}/`);
}

export async function uploadLogo(id: number, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await client.post<Organization>(
    `/organizations/${id}/logo/`,
    fd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function setLogoFromUrl(id: number, url: string) {
  const res = await client.post<Organization>(
    `/organizations/${id}/logo/`,
    { url },
  );
  return res.data;
}

export async function removeLogo(id: number) {
  await client.delete(`/organizations/${id}/logo/`);
}
