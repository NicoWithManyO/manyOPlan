import type { Assignment, MyEngagement, PaginatedResponse } from "../types/models";
import client from "./client";

export async function getMyEngagements() {
  const res = await client.get<MyEngagement[]>("/assignments/mine/");
  return res.data;
}

export async function getAssignments(eventId: number) {
  const res = await client.get<PaginatedResponse<Assignment>>(
    `/events/${eventId}/assignments/`,
  );
  return res.data;
}

export async function getMyAssignments(eventId: number) {
  const res = await client.get<Assignment[]>(
    `/events/${eventId}/assignments/mine/`,
  );
  return res.data;
}

export async function createAssignment(
  eventId: number,
  slotId: number,
  startDate: string,
  endDate: string,
  userId?: number,
  force?: boolean,
) {
  const res = await client.post<Assignment>(
    `/events/${eventId}/assignments/`,
    {
      slot: slotId,
      start_date: startDate,
      end_date: endDate,
      ...(userId && { user: userId }),
      ...(force && { force }),
    },
  );
  return res.data;
}

export async function deleteAssignment(eventId: number, assignmentId: number) {
  await client.delete(`/events/${eventId}/assignments/${assignmentId}/`);
}

export async function changeAssignmentStatus(
  eventId: number,
  assignmentId: number,
  status: "confirmed" | "backup",
) {
  const res = await client.patch<Assignment>(
    `/events/${eventId}/assignments/${assignmentId}/change_status/`,
    { status },
  );
  return res.data;
}

export async function updateAssignmentTimes(
  eventId: number,
  assignmentId: number,
  startDate: string,
  endDate: string,
) {
  const res = await client.patch<Assignment>(
    `/events/${eventId}/assignments/${assignmentId}/update-times/`,
    { start_date: startDate, end_date: endDate },
  );
  return res.data;
}

export async function moveAssignment(
  eventId: number,
  assignmentId: number,
  newSlotId: number,
) {
  const res = await client.patch<Assignment>(
    `/events/${eventId}/assignments/${assignmentId}/move/`,
    { slot: newSlotId },
  );
  return res.data;
}
