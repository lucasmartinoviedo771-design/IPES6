import { client } from "./client";

export interface GuiaUsuario {
  rol: string;
  manual: string;
}

export const fetchGuiaUsuario = async (): Promise<GuiaUsuario> => {
  const { data } = await client.get<GuiaUsuario>("/guia-usuario");
  return data;
};
