import client from "./client";

export interface UserSearchResult {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export async function searchUsers(query: string) {
  const res = await client.get<UserSearchResult[]>("/auth/users/search/", {
    params: { q: query },
  });
  return res.data;
}

export async function quickCreateVolunteer(firstName: string, lastName: string) {
  const res = await client.post<{ id: number; username: string; full_name: string }>(
    "/auth/users/quick-create/",
    { first_name: firstName, last_name: lastName },
  );
  return res.data;
}
