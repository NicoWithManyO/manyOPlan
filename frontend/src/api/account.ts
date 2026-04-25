import client from "./client";

export async function changePassword(data: {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}) {
  const res = await client.post("/auth/change-password/", data);
  return res.data;
}
