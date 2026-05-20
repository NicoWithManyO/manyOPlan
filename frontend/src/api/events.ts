import type {
  Event,
  EventCreateData,
  EventInvitation,
  EventInvitationCreateData,
  EventMembership,
  PaginatedResponse,
} from "../types/models";
import client from "./client";

export async function getEvents(orgId?: number) {
  const url = orgId ? `/events/?organization=${orgId}` : "/events/";
  const res = await client.get<PaginatedResponse<Event>>(url);
  return res.data;
}

export async function getEvent(id: number) {
  const res = await client.get<Event>(`/events/${id}/`);
  return res.data;
}

export async function createEvent(data: EventCreateData) {
  const res = await client.post<Event>("/events/", data);
  return res.data;
}

export async function updateEvent(id: number, data: Partial<EventCreateData>) {
  const res = await client.patch<Event>(`/events/${id}/`, data);
  return res.data;
}

export async function deleteEvent(id: number) {
  await client.delete(`/events/${id}/`);
}

export async function joinEvent(id: number) {
  const res = await client.post(`/events/${id}/join/`);
  return res.data;
}

export async function leaveEvent(id: number) {
  await client.post(`/events/${id}/leave/`);
}

export async function getMembers(eventId: number) {
  const res = await client.get<PaginatedResponse<EventMembership>>(
    `/events/${eventId}/members/`,
  );
  return res.data;
}

export async function addMember(eventId: number, userId: number, role: "admin" | "volunteer") {
  const res = await client.post<EventMembership>(
    `/events/${eventId}/members/`,
    { user: userId, role },
  );
  return res.data;
}

export async function updateMemberRole(
  eventId: number,
  membershipId: number,
  role: "admin" | "volunteer",
) {
  const res = await client.patch<EventMembership>(
    `/events/${eventId}/members/${membershipId}/`,
    { role },
  );
  return res.data;
}

export async function getEventInvitations(eventId: number) {
  const res = await client.get<EventInvitation[]>(
    `/events/${eventId}/invitations/`,
  );
  return res.data;
}

export async function createEventInvitation(
  eventId: number,
  data: EventInvitationCreateData,
) {
  const res = await client.post<EventInvitation>(
    `/events/${eventId}/invitations/`,
    data,
  );
  return res.data;
}

export async function deleteEventInvitation(
  eventId: number,
  invitationId: number,
) {
  await client.delete(`/events/${eventId}/invitations/${invitationId}/`);
}

