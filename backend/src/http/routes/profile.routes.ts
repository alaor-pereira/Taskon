import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { auth } from "../../lib/auth.js";
import { naoAutenticado } from "../../lib/errors.js";
import {
  excluirConta,
  preparacaoDaExclusao,
} from "../../modules/profile/account-deletion.service.js";
import {
  obterAvatar,
  removerAvatar,
  resumoDoPerfil,
  salvarAvatar,
} from "../../modules/profile/profile.service.js";
import { paraHeaders } from "../headers.js";
import { exigirAutenticacao, usuarioDe } from "../session.js";

const corpoDoAvatar = z.object({ imagem: z.string().min(1) });

const corpoDaExclusao = z.object({
  email: z.string().min(1),
  senha: z.string().optional(),
});

/** Quando a sessão atual começou: quem não tem senha confirma com um login recente. */
async function inicioDaSessao(request: FastifyRequest): Promise<Date> {
  const sessao = await auth.api.getSession({ headers: paraHeaders(request) });
  if (!sessao) throw naoAutenticado();
  return new Date(sessao.session.createdAt);
}

/** "Meu perfil": números da página e a foto do próprio usuário. */
export async function rotasDePerfil(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", exigirAutenticacao);

  app.get("/resumo", async (request) => resumoDoPerfil(usuarioDe(request).id));

  app.put("/avatar", async (request) => {
    const { imagem } = corpoDoAvatar.parse(request.body);
    return salvarAvatar(usuarioDe(request).id, imagem);
  });

  app.delete("/avatar", async (request, reply) => {
    await removerAvatar(usuarioDe(request).id);
    return reply.status(204).send();
  });

  app.get("/exclusao", async (request) =>
    preparacaoDaExclusao(usuarioDe(request).id, await inicioDaSessao(request)),
  );

  app.delete("/conta", async (request, reply) => {
    const { email, senha } = corpoDaExclusao.parse(request.body);
    await excluirConta(usuarioDe(request).id, {
      email,
      senha,
      sessaoCriadaEm: await inicioDaSessao(request),
    });
    return reply.status(204).send();
  });
}

const parametrosDoUsuario = z.object({ userId: z.string().uuid() });

/**
 * A foto é pública: o `<img>` de outra origem não leva o cookie de sessão, e o
 * id é um UUID. A URL carrega a versão (`?v=`), então pode ficar em cache para
 * sempre — uma foto nova tem outro endereço.
 */
export async function rotasDeUsuarios(app: FastifyInstance): Promise<void> {
  app.get("/:userId/avatar", async (request, reply) => {
    const { userId } = parametrosDoUsuario.parse(request.params);
    const { data, mimeType } = await obterAvatar(userId);
    return reply
      .header("Content-Type", mimeType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      // O <img> do frontend pode estar em outro site; o resto da API não.
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .send(data);
  });
}
