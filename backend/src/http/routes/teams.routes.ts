import { TeamRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  alterarPapelDeMembro,
  atualizarEquipe,
  criarEquipe,
  excluirEquipe,
  listarEquipes,
  obterEquipe,
  removerMembro,
  transferirPropriedade,
} from "../../modules/teams/teams.service.js";
import {
  cancelarConvite,
  convidarParaEquipe,
  listarConvitesDaEquipe,
} from "../../modules/invitations/invitations.service.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const idDaEquipe = z.object({ teamId: z.string().uuid() });
const papel = z.nativeEnum(TeamRole);

export async function rotasDeEquipes(app: FastifyInstance): Promise<void> {
  // Toda rota deste módulo exige sessão. A interface esconder o botão não
  // dispensa a verificação: a API pode ser chamada diretamente.
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/", async (request) => {
    return listarEquipes(usuarioDe(request).id);
  });

  app.post("/", async (request, reply) => {
    const corpo = z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).optional(),
      })
      .parse(request.body);

    const equipe = await criarEquipe(usuarioDe(request).id, corpo);
    return reply.status(201).send(equipe);
  });

  app.get("/:teamId", async (request) => {
    const { teamId } = idDaEquipe.parse(request.params);
    return obterEquipe(usuarioDe(request).id, teamId);
  });

  app.patch("/:teamId", async (request) => {
    const { teamId } = idDaEquipe.parse(request.params);
    const corpo = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).nullable().optional(),
      })
      .parse(request.body);

    return atualizarEquipe(usuarioDe(request).id, teamId, corpo);
  });

  app.delete("/:teamId", async (request, reply) => {
    const { teamId } = idDaEquipe.parse(request.params);
    await excluirEquipe(usuarioDe(request).id, teamId);
    return reply.status(204).send();
  });

  app.post("/:teamId/transferir", async (request, reply) => {
    const { teamId } = idDaEquipe.parse(request.params);
    const { novoDonoId } = z
      .object({ novoDonoId: z.string().uuid() })
      .parse(request.body);

    await transferirPropriedade(usuarioDe(request).id, teamId, novoDonoId);
    return reply.status(204).send();
  });

  // --- Membros -------------------------------------------------------------

  app.patch("/:teamId/membros/:membroId", async (request) => {
    const { teamId, membroId } = idDaEquipe
      .extend({ membroId: z.string().uuid() })
      .parse(request.params);
    const { role } = z.object({ role: papel }).parse(request.body);

    return alterarPapelDeMembro(usuarioDe(request).id, teamId, membroId, role);
  });

  app.delete("/:teamId/membros/:membroId", async (request, reply) => {
    const { teamId, membroId } = idDaEquipe
      .extend({ membroId: z.string().uuid() })
      .parse(request.params);

    await removerMembro(usuarioDe(request).id, teamId, membroId);
    return reply.status(204).send();
  });

  /** Sair da equipe. Mesmas regras da remoção, aplicadas a si mesmo. */
  app.post("/:teamId/sair", async (request, reply) => {
    const { teamId } = idDaEquipe.parse(request.params);
    const usuario = usuarioDe(request);

    await removerMembro(usuario.id, teamId, usuario.id);
    return reply.status(204).send();
  });

  // --- Convites ------------------------------------------------------------

  app.get("/:teamId/convites", async (request) => {
    const { teamId } = idDaEquipe.parse(request.params);
    return listarConvitesDaEquipe(usuarioDe(request).id, teamId);
  });

  app.post("/:teamId/convites", async (request, reply) => {
    const { teamId } = idDaEquipe.parse(request.params);
    const corpo = z
      .object({ email: z.string().email(), role: papel })
      .parse(request.body);

    const { convite } = await convidarParaEquipe(
      usuarioDe(request).id,
      teamId,
      corpo,
    );
    // O token nunca volta na resposta: ele só existe no link do e-mail.
    return reply.status(201).send({
      id: convite.id,
      email: convite.email,
      role: convite.role,
      expiresAt: convite.expiresAt,
    });
  });

  app.delete("/:teamId/convites/:conviteId", async (request, reply) => {
    const { teamId, conviteId } = idDaEquipe
      .extend({ conviteId: z.string().uuid() })
      .parse(request.params);

    await cancelarConvite(usuarioDe(request).id, teamId, conviteId);
    return reply.status(204).send();
  });
}
