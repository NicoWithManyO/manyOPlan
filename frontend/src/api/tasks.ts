import type {
  PaginatedResponse,
  Slot,
  SlotCreateData,
  Task,
  TaskCreateData,
} from "../types/models";
import client from "./client";

// Tasks
export async function getTasks(eventId: number) {
  const res = await client.get<PaginatedResponse<Task>>(
    `/events/${eventId}/tasks/`,
  );
  return res.data;
}

export async function createTask(eventId: number, data: TaskCreateData) {
  const res = await client.post<Task>(`/events/${eventId}/tasks/`, data);
  return res.data;
}

export async function updateTask(
  eventId: number,
  taskId: number,
  data: Partial<TaskCreateData>,
) {
  const res = await client.patch<Task>(
    `/events/${eventId}/tasks/${taskId}/`,
    data,
  );
  return res.data;
}

export async function deleteTask(eventId: number, taskId: number) {
  await client.delete(`/events/${eventId}/tasks/${taskId}/`);
}

export async function reorderTasks(eventId: number, taskIds: number[]) {
  await client.post(`/events/${eventId}/tasks/reorder/`, {
    task_ids: taskIds,
  });
}

// Slots
export async function createSlot(
  eventId: number,
  taskId: number,
  data: SlotCreateData,
) {
  const res = await client.post<Slot>(
    `/events/${eventId}/tasks/${taskId}/slots/`,
    data,
  );
  return res.data;
}

export async function bulkCreateSlots(
  eventId: number,
  taskId: number,
  slots: SlotCreateData[],
) {
  const res = await client.post<Slot[]>(
    `/events/${eventId}/tasks/${taskId}/slots/bulk/`,
    { slots },
  );
  return res.data;
}

export async function updateSlot(
  eventId: number,
  taskId: number,
  slotId: number,
  data: Partial<SlotCreateData>,
) {
  const res = await client.patch<Slot>(
    `/events/${eventId}/tasks/${taskId}/slots/${slotId}/`,
    data,
  );
  return res.data;
}

export async function deleteSlot(
  eventId: number,
  taskId: number,
  slotId: number,
) {
  await client.delete(`/events/${eventId}/tasks/${taskId}/slots/${slotId}/`);
}
