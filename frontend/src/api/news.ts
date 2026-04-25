import type { News, PaginatedResponse } from "../types/models";
import client from "./client";

export async function getEventNews(eventId: number) {
  const res = await client.get<PaginatedResponse<News>>(
    `/events/${eventId}/news/`,
  );
  return res.data;
}

export async function createNews(
  eventId: number,
  data: { title: string; content: string },
) {
  const res = await client.post<News>(`/events/${eventId}/news/`, data);
  return res.data;
}

export async function deleteNews(eventId: number, newsId: number) {
  await client.delete(`/events/${eventId}/news/${newsId}/`);
}
