import { client } from "@/api/client";

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export async function changePassword(payload: ChangePasswordPayload) {
  // Django/Ninja expone la ruta con slash final; sin él responde 405 (Method Not Allowed).
  const { data } = await client.post("/auth/change-password/", payload);
  return data;
}
