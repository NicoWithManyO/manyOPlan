import client from "./client";

export interface TaskStat {
  id: number;
  name: string;
  slot_count: number;
  total_capacity: number | null;
  total_confirmed: number;
  incomplete_slots: number;
}

export interface DashboardData {
  total_tasks: number;
  total_slots: number;
  total_members: number;
  total_volunteers: number;
  total_assignments: number;
  total_confirmed: number;
  total_backup: number;
  free_volunteers: { id: number; username: string; full_name: string }[];
  free_volunteer_count: number;
  task_stats: TaskStat[];
}

export async function getDashboard(eventId: number) {
  const res = await client.get<DashboardData>(`/events/${eventId}/dashboard/`);
  return res.data;
}
