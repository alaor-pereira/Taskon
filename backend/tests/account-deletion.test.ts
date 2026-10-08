import { EventKind, ProjectRole, TermsAcceptanceOrigin } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { gerarHashDeSenha } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import {
  JANELA_DE_SESSAO_RECENTE_MS,
  NOME_ANONIMO,
  excluirConta,
  preparacaoDaExclusao,
} from "../src/modules/profile/account-deletion.service.js";
import {
  adicionarAoProjeto,
  criarEquipe,
  criarProjeto,
  criarTarefa,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

const agora = () => new Date();
const antiga = () => new Date(Date.now() - JANELA_DE_SESSAO_RECENTE_MS - 1000);

async function comSenha(userId: string, senha = "senha-segura") {
  await prisma.account.create({
    data: {
      userId,
      accountId: userId,
      providerId: "credential",
      password: await gerarHashDeSenha(senha),
    },
  });
}

function evento(ownerId: string, kind: EventKind, titulo: string) {
  return prisma.calendarEvent.create({
    data: {
      kind,
      ownerId,
      title: titulo,
      startsAt: new Date("2026-10-10T12:00:00Z"),
      endsAt: new Date("2026-10-10T13:00:00Z"),
      timezone: "America/Sao_Paulo",
    },
  });
}

describe("bloqueios da exclusão de conta", () => {
  it("bloqueia o dono de equipe e de projeto com outros membros, não o de projeto pessoal", async () => {
    const ana = await criarUsuario();
    const bruno = await criarUsuario();
    const equipe = await criarEquipe(ana.id, "Equipe da Ana");
    const compartilhado = await criarProjeto(ana.id, { nome: "Compartilhado" });
    await adicionarAoProjeto(compartilhado.id, bruno.id, ProjectRole.EDITOR);
    await criarProjeto(ana.id, { nome: "Pessoal" });
    await criarProjeto(ana.id, { isInbox: true });

    const situacao = await preparacaoDaExclusao(ana.id, agora());
    expect(situacao.equipes).toEqual([{ id: equipe.id, nome: "Equipe da Ana" }]);
    expect(situacao.projetos).toEqual([{ id: compartilhado.id, nome: "Compartilhado" }]);
    expect(situacao).toMatchObject({ temSenha: false, sessaoRecente: true });
  });

  it("recusa a exclusão enquanto houver bloqueio", async () => {
    const ana = await criarUsuario();
    await criarEquipe(ana.id);
    await comSenha(ana.id);

    await expect(
      excluirConta(ana.id, { email: ana.email, senha: "senha-segura", sessaoCriadaEm: agora() }),
    ).rejects.toMatchObject({ code: "CONFLITO" });
  });
});

describe("confirmação da exclusão", () => {
  it("exige o e-mail da conta", async () => {
    const ana = await criarUsuario();
    await comSenha(ana.id);

    await expect(
      excluirConta(ana.id, { email: "outro@teste.local", senha: "senha-segura", sessaoCriadaEm: agora() }),
    ).rejects.toMatchObject({ code: "DADOS_INVALIDOS" });
  });

  it("exige a senha correta de quem tem senha", async () => {
    const ana = await criarUsuario();
    await comSenha(ana.id);

    await expect(
      excluirConta(ana.id, { email: ana.email, senha: "errada", sessaoCriadaEm: agora() }),
    ).rejects.toMatchObject({ code: "DADOS_INVALIDOS" });
  });

  it("exige login recente de quem entra só pelo login social", async () => {
    const ana = await criarUsuario();
    await prisma.account.create({ data: { userId: ana.id, accountId: "g-1", providerId: "google" } });

    await expect(
      excluirConta(ana.id, { email: ana.email, sessaoCriadaEm: antiga() }),
    ).rejects.toMatchObject({ code: "REGRA_DE_NEGOCIO", details: { motivo: "REAUTENTICAR" } });

    await excluirConta(ana.id, { email: ana.email.toUpperCase(), sessaoCriadaEm: agora() });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: ana.id } })).anonymizedAt).not.toBeNull();
  });
});

describe("anonimização", () => {
  it("apaga o que é pessoal e mantém o colaborativo sem identificar a pessoa", async () => {
    const ana = await criarUsuario("Ana Souza");
    const bruno = await criarUsuario("Bruno");
    await comSenha(ana.id);

    // Pessoal: some.
    const caixa = await criarProjeto(ana.id, { isInbox: true });
    const pessoal = await criarProjeto(ana.id);
    await criarTarefa(pessoal.id, ana.id);
    const atividade = await evento(ana.id, EventKind.ATIVIDADE, "Dentista");
    const reuniaoSozinha = await evento(ana.id, EventKind.REUNIAO, "Só eu");
    await prisma.notification.create({
      data: { userId: ana.id, type: "TAREFA_ATRIBUIDA", payload: {} },
    });
    await prisma.session.create({
      data: { userId: ana.id, token: "tok-ana", expiresAt: new Date(Date.now() + 60_000) },
    });

    // Colaborativo: fica.
    const doBruno = await criarProjeto(bruno.id);
    await adicionarAoProjeto(doBruno.id, ana.id, ProjectRole.EDITOR);
    const tarefa = await criarTarefa(doBruno.id, ana.id);
    await prisma.taskAssignee.create({ data: { taskId: tarefa.id, userId: ana.id } });
    const comentario = await prisma.comment.create({
      data: { taskId: tarefa.id, authorId: ana.id, bodyMd: "Feito." },
    });
    const reuniao = await evento(ana.id, EventKind.REUNIAO, "Planejamento");
    await prisma.eventParticipant.create({ data: { eventId: reuniao.id, userId: bruno.id } });
    await prisma.termsAcceptance.create({
      data: { userId: ana.id, version: "2026-10-05", origin: TermsAcceptanceOrigin.CADASTRO },
    });

    await excluirConta(ana.id, { email: ana.email, senha: "senha-segura", sessaoCriadaEm: agora() });

    const anonima = await prisma.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(anonima).toMatchObject({ name: NOME_ANONIMO, image: null, emailVerified: false });
    expect(anonima.email).not.toBe(ana.email);
    expect(anonima.anonymizedAt).not.toBeNull();

    expect(await prisma.project.count({ where: { id: { in: [caixa.id, pessoal.id] } } })).toBe(0);
    expect(
      await prisma.calendarEvent.count({ where: { id: { in: [atividade.id, reuniaoSozinha.id] } } }),
    ).toBe(0);
    expect(await prisma.notification.count({ where: { userId: ana.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: ana.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: ana.id } })).toBe(0);
    expect(await prisma.projectMember.count({ where: { userId: ana.id } })).toBe(0);
    expect(await prisma.taskAssignee.count({ where: { userId: ana.id } })).toBe(0);

    expect(await prisma.comment.findUnique({ where: { id: comentario.id } })).not.toBeNull();
    expect(await prisma.task.findUnique({ where: { id: tarefa.id } })).not.toBeNull();
    expect(await prisma.calendarEvent.findUnique({ where: { id: reuniao.id } })).not.toBeNull();
    expect(await prisma.termsAcceptance.count({ where: { userId: ana.id } })).toBe(1);
  });
});
