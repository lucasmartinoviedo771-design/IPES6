/**
 * @module Features/AsistenteIA/API
 * @description Cliente API para interactuar con el Asistente Virtual Inteligente de IPES6.
 */

import { api } from "@/api/client";

export interface ChatMessage {
	role: "user" | "model" | "assistant";
	content: string;
}

export interface ChatRequestIn {
	mensaje: string;
	historial?: ChatMessage[];
}

export interface ChatResponseOut {
	respuesta: string;
	sugerencias: string[];
	herramientas_ejecutadas: string[];
	ok: boolean;
}

export interface SugerenciasOut {
	sugerencias: string[];
}

/**
 * Envía una consulta al asistente virtual con el historial de la conversación.
 */
export async function enviarMensajeAsistente(
	mensaje: string,
	historial: ChatMessage[] = [],
): Promise<ChatResponseOut> {
	const resp = await api.post<ChatResponseOut>("/asistente/chat/", {
		mensaje,
		historial,
	});
	return resp.data;
}

/**
 * Obtiene las preguntas frecuentes y sugerencias iniciales según el perfil del usuario.
 */
export async function obtenerSugerenciasAsistente(): Promise<string[]> {
	const resp = await api.get<SugerenciasOut>("/asistente/sugerencias/");
	return resp.data.sugerencias;
}
