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

export async function requestPasswordReset(login: string) {
	const { data } = await client.post("/auth/password-reset/request/", { login });
	return data;
}

export async function confirmPasswordReset(token: string, new_password: string) {
	const { data } = await client.post("/auth/password-reset/confirm/", {
		token,
		new_password,
	});
	return data;
}
