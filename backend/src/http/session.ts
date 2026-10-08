import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../lib/auth.js";
import { naoAutenticado } from "../lib/errors.js";
import { fusoValido } from "../modules/calendar/timezone.js";
import { paraHeaders } from "./headers.js";

/** Identidade resolvida a partir do cookie de sessão. */
export interface Autenticado {
  id: string;
  email: string;
  name: string;
  timezone: string;
}

declare module "fastify" {
  interface FastifyRequest {
    usuario?: Autenticado;
  }
}

export async function resolverUsuario(
  request: FastifyRequest,
): Promise<Autenticado | null> {
  const sessao = await auth.api.getSession({ headers: paraHeaders(request) });
  if (!sessao?.user) return null;

  const usuario = sessao.user as typeof sessao.user & { timezone?: string };
  return {
    id: usuario.id,
    email: usuario.email,
    name: usuario.name,
    // O fuso agora é validado na entrada, mas perfis antigos podem guardar um
    // valor que o Intl recusa; cair no padrão evita derrubar a agenda.
    timezone:
      usuario.timezone && fusoValido(usuario.timezone) ? usuario.timezone : "America/Sao_Paulo",
  };
}

/**
 * Guarda de autenticação. Usada como `preHandler` em toda rota de negócio —
 * a interface esconder um botão não substitui esta verificação.
 */
export async function exigirAutenticacao(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const usuario = await resolverUsuario(request);
  if (!usuario) throw naoAutenticado();
  request.usuario = usuario;
}

/** Atalho para os serviços, que sempre recebem o ator já resolvido. */
export function usuarioDe(request: FastifyRequest): Autenticado {
  if (!request.usuario) throw naoAutenticado();
  return request.usuario;
}
