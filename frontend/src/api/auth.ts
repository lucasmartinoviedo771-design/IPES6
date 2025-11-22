import { client } from "@/api/client";

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export async function changePassword(payload: ChangePasswordPayload) {
  const { data } = await client.post("/auth/change-password", payload);
  return data;
}

