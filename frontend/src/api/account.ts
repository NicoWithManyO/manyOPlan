import client from "./client";

export async function changePassword(data: {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}) {
  const res = await client.post("/auth/change-password/", data);
  return res.data;
}

export async function exportMyData() {
  const res = await client.get("/auth/me/export/");
  return res.data;
}

export async function deleteMyAccount(password: string) {
  await client.delete("/auth/me/delete/", { data: { password } });
}
