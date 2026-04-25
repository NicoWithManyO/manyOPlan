import type { AuthTokens, LoginData, RegisterData, RegisterResponse, User } from "../types/models";
import client from "./client";

export async function register(data: RegisterData) {
  const res = await client.post<RegisterResponse>(
    "/auth/register/",
    data,
  );
  return res.data;
}

export async function login(data: LoginData) {
  const res = await client.post<AuthTokens>("/auth/token/", data);
  return res.data;
}

export async function getMe() {
  const res = await client.get<User>("/auth/me/");
  return res.data;
}

export async function updateMe(data: Partial<User>) {
  const res = await client.patch<User>("/auth/me/", data);
  return res.data;
}

export async function logout(refreshToken: string) {
  await client.post("/auth/logout/", { refresh: refreshToken });
}
