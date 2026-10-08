import { InvitationStatus, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import {
  aceitarConvite,
  convidarParaEquipe,
  listarConvitesRecebidos,
  recusarConvite,
  verConvitePorToken,
  vincularConvitesPendentes,
} from "../src/modules/invitations/invitations.service.js";
import {
  adicionarAEquipe,
  criarEquipe,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

async function erroDe(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (erro) {
    return erro instanceof AppError ? erro : null;
  }
}

describe("enviar convite", () => {
  it("quem já tem conta recebe notificação, e não token por e-mail", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    const { token } = await convidarParaEquipe(dono.id, equipe.id, {
      email: convidado.email,
      role: TeamRole.MEMBRO,
    });

    // Sem token de e-mail: o aviso aparece dentro do aplicativo.
    expect(token).toBeNull();

    const notificacoes = await prisma.notification.findMany({
      where: { userId: convidado.id },
    });
    expect(notificacoes).toHaveLength(1);
    expect(notificacoes[0]?.type).toBe("CONVITE_EQUIPE");
  });

  it("quem ainda não tem conta recebe um token", async () => {
    const dono = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    const { token } = await convidarParaEquipe(dono.id, equipe.id, {
      email: "novo@teste.local",
      role: TeamRole.MEMBRO,
    });

    expect(token).toBeTruthy();

    // O banco guarda só o hash: um vazamento não entrega convites utilizáveis.
    const convite = await prisma.invitation.findFirst({
      where: { email: "novo@teste.local" },
    });
    expect(convite?.tokenHash).not.toBe(token);
  });

  it("recusa convidar quem já é membro", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    const erro = await erroDe(() =>
      convidarParaEquipe(dono.id, equipe.id, {
        email: membro.email,
        role: TeamRole.MEMBRO,
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("convidar de novo renova, em vez de acumular convites", async () => {
    const dono = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    await convidarParaEquipe(dono.id, equipe.id, {
      email: "alguem@teste.local",
      role: TeamRole.MEMBRO,
    });
    await convidarParaEquipe(dono.id, equipe.id, {
      email: "alguem@teste.local",
      role: TeamRole.GESTOR,
    });

    const convites = await prisma.invitation.findMany({
      where: { teamId: equipe.id, email: "alguem@teste.local" },
    });
    expect(convites).toHaveLength(1);
    expect(convites[0]?.role).toBe(TeamRole.GESTOR);
  });

  it("MEMBRO não convida", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(dono.id);
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    const erro = await erroDe(() =>
      convidarParaEquipe(membro.id, equipe.id, {
        email: "x@teste.local",
        role: TeamRole.MEMBRO,
      }),
    );
    expect(erro?.code).toBe("SEM_PERMISSAO");
  });
});

describe("responder convite", () => {
  it("aceitar adiciona à equipe com o papel convidado", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    const { convite } = await convidarParaEquipe(dono.id, equipe.id, {
      email: convidado.email,
      role: TeamRole.VISUALIZADOR,
    });
    await aceitarConvite(convidado.id, convite.id);

    const membro = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: equipe.id, userId: convidado.id } },
    });
    expect(membro?.role).toBe(TeamRole.VISUALIZADOR);

    const atualizado = await prisma.invitation.findUnique({
      where: { id: convite.id },
    });
    expect(atualizado?.status).toBe(InvitationStatus.ACEITO);
  });

  it("ninguém responde o convite de outra pessoa", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const intruso = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    const { convite } = await convidarParaEquipe(dono.id, equipe.id, {
      email: convidado.email,
      role: TeamRole.MEMBRO,
    });

    // "Não encontrado", e não "sem permissão": o intruso não deve nem saber
    // que este convite existe.
    const erro = await erroDe(() => aceitarConvite(intruso.id, convite.id));
    expect(erro?.code).toBe("NAO_ENCONTRADO");
  });

  it("convite expirado não é aceito e fica marcado como expirado", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    const { convite } = await convidarParaEquipe(dono.id, equipe.id, {
      email: convidado.email,
      role: TeamRole.MEMBRO,
    });
    await prisma.invitation.update({
      where: { id: convite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const erro = await erroDe(() => aceitarConvite(convidado.id, convite.id));
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");

    const atualizado = await prisma.invitation.findUnique({
      where: { id: convite.id },
    });
    expect(atualizado?.status).toBe(InvitationStatus.EXPIRADO);
  });

  it("um convite só é respondido uma vez", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    const { convite } = await convidarParaEquipe(dono.id, equipe.id, {
      email: convidado.email,
      role: TeamRole.MEMBRO,
    });
    await recusarConvite(convidado.id, convite.id);

    const erro = await erroDe(() => aceitarConvite(convidado.id, convite.id));
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });
});

describe("convite por token", () => {
  it("expõe só o necessário para decidir", async () => {
    const dono = await criarUsuario();
    const equipe = await criarEquipe(dono.id, "Equipe Secreta");

    const { token } = await convidarParaEquipe(dono.id, equipe.id, {
      email: "novo@teste.local",
      role: TeamRole.MEMBRO,
    });

    const visao = await verConvitePorToken(token!);
    expect(visao.equipe?.name).toBe("Equipe Secreta");
    expect(visao.expirado).toBe(false);
    // Nada de membros ou projetos da equipe para quem ainda não entrou.
    expect(visao).not.toHaveProperty("membros");
  });

  it("token inválido é indistinguível de convite inexistente", async () => {
    const erro = await erroDe(() => verConvitePorToken("token-que-nao-existe"));
    expect(erro?.code).toBe("NAO_ENCONTRADO");
  });
});

describe("cadastro depois do convite", () => {
  it("convites pendentes passam a aparecer para a conta recém-criada", async () => {
    const dono = await criarUsuario();
    const equipe = await criarEquipe(dono.id);

    await convidarParaEquipe(dono.id, equipe.id, {
      email: "futuro@teste.local",
      role: TeamRole.MEMBRO,
    });

    // Simula o cadastro: o gancho de criação de usuário chama esta função.
    const novo = await prisma.user.create({
      data: { name: "Futuro", email: "futuro@teste.local", emailVerified: true },
    });
    const vinculados = await vincularConvitesPendentes(novo.id, novo.email);

    expect(vinculados).toBe(1);
    expect(await listarConvitesRecebidos(novo.id)).toHaveLength(1);
  });
});
