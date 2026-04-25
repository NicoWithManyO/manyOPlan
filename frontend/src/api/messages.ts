import type { Conversation, Message } from "../types/models";
import client from "./client";

export async function getConversations() {
  const res = await client.get<Conversation[]>("/messages/");
  return res.data;
}

export async function getThread(userId: number) {
  const res = await client.get<Message[]>(`/messages/${userId}/`);
  return res.data;
}

export async function sendMessage(receiverId: number, content: string) {
  const res = await client.post<Message>("/messages/send/", {
    receiver: receiverId,
    content,
  });
  return res.data;
}

export async function getUnreadCount() {
  const res = await client.get<{ unread_count: number }>("/messages/unread-count/");
  return res.data.unread_count;
}
