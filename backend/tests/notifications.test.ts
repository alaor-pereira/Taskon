import { EventKind, ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { daquiADias, hojeNoFuso } from "../src/lib/datas.js";
import { prisma } from "../src/lib/prisma.js";
import {
  atualizarEvento,
  criarEvento,
  excluirEvento,
} from "../src/modules/calendar/calendar.service.js";
import { comentar, editarComentario } from "../src/modules/comments/comments.service.js";
import { avisarVencimentos } from "../src/modules/cron/jobs.service.js";
import {
  convidarParaEquipe,
  recusarConvite,
} from "../src/modules/invitations/invitations.service.js";
import {
  definirNotificacoesDesativadas,
  marcarComoLida,
  obterNotificacoesDesativadas,
} from "../src/modules/notifications/notifications.service.js";
import {
  alterarPapelDeMembro as alterarPapelNoProjeto,
  removerMembro as removerDoProjeto,
} from "../src/modules/projects/projects.service.js";
import { criarTarefa, definirResponsaveis } from "../src/modules/tasks/tasks.service.js";
import { alterarPapelDeMembro as alterarPapelNaEquipe } from "../src/modules/teams/teams.service.js";
import {
  adicionarAEquipe,
  adicionarAoProjeto,
  criarEquipe,
  criarProjeto,
  colegasDeEquipe,
  criarUsuario,
  limparBanco,
} from "./factories.js";

beforeEach(limparBanco);

const SP = "America/Sao_Paulo";

const avisos = (userId: string, type: string) =>
  prisma.notification.findMany({
    where: { userId, type: type as never },
    orderBy: { createdAt: "asc" },
  });

/** Dono e editor num projeto, com uma tarefa do dono atribuída ao editor. */
async function cenario() {
  const dono = await criarUsuario("Ana Souza");
  const editor = await criarUsuario("Bruno Lima");
  const projeto = await criarProjeto(dono.id);
  await adicionarAoProjeto(projeto.id, editor.id, ProjectRole.EDITOR);
  const tarefa = await criarTarefa(dono.id, {
    projectId: projeto.id,
    title: "Revisar contrato",
    assigneeIds: [editor.id],
  });
  return { dono, editor, projeto, tarefa };
}

describe("quem agiu", () => {
  it("o aviso de atribuição leva o nome de quem atribuiu", async () => {
    const { editor } = await cenario();
    const [aviso] = await avisos(editor.id, "TAREFA_ATRIBUIDA");
    expect(aviso?.payload).toMatchObject({
      taskTitle: "Revisar contrato",
      autorNome: "Ana Souza",
    });
  });
});

describe("responsáveis", () => {
  it("avisa quem deixou de ser responsável, menos quem se tirou", async () => {
    const { dono, editor, tarefa } = await cenario();

    await definirResponsaveis(dono.id, tarefa.id, []);
    expect(await avisos(editor.id, "TAREFA_DESATRIBUIDA")).toHaveLength(1);

    await definirResponsaveis(editor.id, tarefa.id, [editor.id]);
    await definirResponsaveis(editor.id, tarefa.id, []);
    expect(await avisos(editor.id, "TAREFA_DESATRIBUIDA")).toHaveLength(1);
  });
});

describe("tarefa atrasada", () => {
  it("avisa uma vez, no dia seguinte ao vencimento", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Venceu ontem",
      dueDate: daquiADias(SP, -1),
      assigneeIds: [dono.id],
    });

    await avisarVencimentos();
    await avisarVencimentos();

    expect(await avisos(dono.id, "TAREFA_ATRASADA")).toHaveLength(1);
    expect(await avisos(dono.id, "TAREFA_VENCENDO")).toHaveLength(0);
  });

  it("não avisa atraso de tarefa que vence hoje", async () => {
    const dono = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Hoje",
      dueDate: hojeNoFuso(SP),
      assigneeIds: [dono.id],
    });

    await avisarVencimentos();
    expect(await avisos(dono.id, "TAREFA_ATRASADA")).toHaveLength(0);
  });
});

describe("comentários na tarefa", () => {
  it("avisa responsáveis e criador, menos o autor, agrupando enquanto não lido", async () => {
    const { dono, editor, tarefa } = await cenario();

    await comentar(editor.id, tarefa.id, "Primeiro");
    await comentar(editor.id, tarefa.id, "Segundo");

    const doDono = await avisos(dono.id, "COMENTARIO_NA_TAREFA");
    expect(doDono).toHaveLength(1);
    expect(doDono[0]?.payload).toMatchObject({ quantidade: 2, autorNome: "Bruno Lima" });
    // O autor não é avisado do próprio comentário.
    expect(await avisos(editor.id, "COMENTARIO_NA_TAREFA")).toHaveLength(0);

    // Depois de lido, o próximo comentário abre um aviso novo.
    await marcarComoLida(dono.id, doDono[0]!.id);
    await comentar(editor.id, tarefa.id, "Terceiro");
    expect(await avisos(dono.id, "COMENTARIO_NA_TAREFA")).toHaveLength(2);
  });

  it("quem foi mencionado recebe só o aviso de menção", async () => {
    const { dono, editor, tarefa } = await cenario();
    await comentar(editor.id, tarefa.id, `Olha isso, @${dono.email.split("@")[0]}`);

    expect(await avisos(dono.id, "MENCAO_COMENTARIO")).toHaveLength(1);
    expect(await avisos(dono.id, "COMENTARIO_NA_TAREFA")).toHaveLength(0);
  });

  it("editar avisa só quem passou a ser mencionado", async () => {
    const { dono, editor, tarefa } = await cenario();
    const outro = await criarUsuario("Carla Dias");
    await adicionarAoProjeto(tarefa.projectId, outro.id, ProjectRole.EDITOR);
    const apelido = (email: string) => email.split("@")[0];

    const comentario = await comentar(dono.id, tarefa.id, `Oi @${apelido(editor.email)}`);
    await editarComentario(
      dono.id,
      comentario.id,
      `Oi @${apelido(editor.email)} e @${apelido(outro.email)}`,
    );

    expect(await avisos(editor.id, "MENCAO_COMENTARIO")).toHaveLength(1);
    expect(await avisos(outro.id, "MENCAO_COMENTARIO")).toHaveLength(1);
  });
});

describe("reuniões", () => {
  function reuniao(participantIds: string[], extras: Record<string, unknown> = {}) {
    const inicio = new Date(Date.now() + 2 * 24 * 60 * 60_000);
    inicio.setUTCMinutes(0, 0, 0);
    return {
      kind: EventKind.REUNIAO,
      title: "Planejamento",
      startsAt: inicio.toISOString(),
      endsAt: new Date(inicio.getTime() + 60 * 60_000).toISOString(),
      timezone: SP,
      participantIds,
      ...extras,
    };
  }

  /** O formulário reenvia todos os campos; só alguns contam como mudança. */
  const reenvio = (evento: { title: string; startsAt: Date; endsAt: Date }) => ({
    title: evento.title,
    locationOrLink: null,
    startsAt: evento.startsAt.toISOString(),
    endsAt: evento.endsAt.toISOString(),
  });

  it("mudar o horário avisa os participantes; mudar só a descrição, não", async () => {
    const organizador = await criarUsuario("Ana Souza");
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    const evento = await criarEvento(organizador.id, reuniao([convidado.id]));

    await atualizarEvento(organizador.id, evento.id, {
      ...reenvio(evento),
      description: "Pauta nova",
    });
    expect(await avisos(convidado.id, "REUNIAO_ALTERADA")).toHaveLength(0);

    const maisTarde = new Date(evento.startsAt.getTime() + 60 * 60_000);
    await atualizarEvento(organizador.id, evento.id, {
      ...reenvio(evento),
      startsAt: maisTarde.toISOString(),
      endsAt: new Date(maisTarde.getTime() + 60 * 60_000).toISOString(),
    });
    const alteradas = await avisos(convidado.id, "REUNIAO_ALTERADA");
    expect(alteradas).toHaveLength(1);
    expect(alteradas[0]?.payload).toMatchObject({ escopo: "TODAS", autorNome: "Ana Souza" });
    expect(await avisos(organizador.id, "REUNIAO_ALTERADA")).toHaveLength(0);
  });

  it("reenviar a mesma repetição não conta como mudança", async () => {
    const organizador = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    const recorrencia = { frequencia: "SEMANAL" as const, termino: { tipo: "APOS" as const, ocorrencias: 3 } };
    const evento = await criarEvento(organizador.id, reuniao([convidado.id], { recorrencia }));

    await atualizarEvento(organizador.id, evento.id, {
      ...reenvio(evento),
      recorrencia,
      escopo: "TODAS",
      ocorrencia: evento.startsAt.toISOString(),
    });
    expect(await avisos(convidado.id, "REUNIAO_ALTERADA")).toHaveLength(0);
  });

  it("cancelar avisa os participantes", async () => {
    const organizador = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    const evento = await criarEvento(organizador.id, reuniao([convidado.id]));

    await excluirEvento(organizador.id, evento.id);

    const canceladas = await avisos(convidado.id, "REUNIAO_CANCELADA");
    expect(canceladas).toHaveLength(1);
    expect(canceladas[0]?.payload).toMatchObject({ title: "Planejamento" });
  });
});

describe("pessoas", () => {
  it("projeto: avisa quem teve o papel alterado ou foi removido", async () => {
    const { dono, editor, projeto } = await cenario();

    await alterarPapelNoProjeto(dono.id, projeto.id, editor.id, ProjectRole.VIEWER);
    await removerDoProjeto(dono.id, projeto.id, editor.id);

    const eventos = (await avisos(editor.id, "CONVITE_PROJETO")).map(
      (n) => (n.payload as { evento: string }).evento,
    );
    expect(eventos).toEqual(
      expect.arrayContaining(["PAPEL_ALTERADO", "REMOVIDO_DO_PROJETO"]),
    );
  });

  it("projeto: sair por conta própria não gera aviso", async () => {
    const { editor, projeto } = await cenario();
    await removerDoProjeto(editor.id, projeto.id, editor.id);

    const eventos = (await avisos(editor.id, "CONVITE_PROJETO")).map(
      (n) => (n.payload as { evento: string }).evento,
    );
    expect(eventos).not.toContain("REMOVIDO_DO_PROJETO");
  });

  it("equipe: avisa quem teve o papel alterado", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(dono.id, "Design");
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    await alterarPapelNaEquipe(dono.id, equipe.id, membro.id, TeamRole.GESTOR);

    const [aviso] = await avisos(membro.id, "CONVITE_EQUIPE");
    expect(aviso?.payload).toMatchObject({
      evento: "PAPEL_ALTERADO",
      teamName: "Design",
      role: TeamRole.GESTOR,
    });
  });

  it("convite recusado avisa quem convidou", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario("Carla Dias");
    const equipe = await criarEquipe(dono.id, "Design");

    await convidarParaEquipe(dono.id, equipe.id, {
      email: convidado.email,
      role: TeamRole.MEMBRO,
    });
    const convite = await prisma.invitation.findFirstOrThrow({ where: { teamId: equipe.id } });
    await recusarConvite(convidado.id, convite.id);

    const [aviso] = await avisos(dono.id, "CONVITE_EQUIPE");
    expect(aviso?.payload).toMatchObject({
      evento: "CONVITE_RECUSADO",
      teamName: "Design",
      porNome: "Carla Dias",
    });
  });
});

describe("avisos desligados pelo usuário", () => {
  it("quem desligou não recebe; os outros continuam recebendo", async () => {
    const dono = await criarUsuario();
    const ana = await criarUsuario();
    const bruno = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, ana.id, ProjectRole.EDITOR);
    await adicionarAoProjeto(projeto.id, bruno.id, ProjectRole.EDITOR);

    await definirNotificacoesDesativadas(ana.id, ["TAREFA_ATRIBUIDA"]);
    await criarTarefa(dono.id, {
      projectId: projeto.id,
      title: "Planejar sprint",
      assigneeIds: [ana.id, bruno.id],
    });

    expect(await avisos(ana.id, "TAREFA_ATRIBUIDA")).toHaveLength(0);
    expect(await avisos(bruno.id, "TAREFA_ATRIBUIDA")).toHaveLength(1);
  });

  it("desligar um evento de equipe não cala o convite, que pede resposta", async () => {
    const dono = await criarUsuario();
    const convidado = await criarUsuario();
    const equipe = await criarEquipe(dono.id, "Design");

    await definirNotificacoesDesativadas(convidado.id, ["EQUIPE:PAPEL_ALTERADO"]);
    await convidarParaEquipe(dono.id, equipe.id, {
      email: convidado.email,
      role: TeamRole.MEMBRO,
    });

    const [aviso] = await avisos(convidado.id, "CONVITE_EQUIPE");
    expect(aviso?.payload).toMatchObject({ evento: "CONVITE_RECEBIDO" });
  });

  it("desliga só o evento escolhido dentro do grupo", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const equipe = await criarEquipe(dono.id, "Design");
    await adicionarAEquipe(equipe.id, membro.id, TeamRole.MEMBRO);

    await definirNotificacoesDesativadas(membro.id, ["EQUIPE:PAPEL_ALTERADO"]);
    await alterarPapelNaEquipe(dono.id, equipe.id, membro.id, TeamRole.GESTOR);

    expect(await avisos(membro.id, "CONVITE_EQUIPE")).toHaveLength(0);
  });

  it("o aviso agrupado de comentários respeita a escolha", async () => {
    const { dono, editor, tarefa } = await cenario();
    await definirNotificacoesDesativadas(dono.id, ["COMENTARIO_NA_TAREFA"]);

    await comentar(editor.id, tarefa.id, "Primeiro");

    expect(await avisos(dono.id, "COMENTARIO_NA_TAREFA")).toHaveLength(0);
  });

  it("guarda o conjunto escolhido e recusa avisos que não podem ser desligados", async () => {
    const ana = await criarUsuario();
    await definirNotificacoesDesativadas(ana.id, ["REUNIAO_ALTERADA", "TAREFA_VENCENDO"]);
    expect(await obterNotificacoesDesativadas(ana.id)).toEqual([
      "REUNIAO_ALTERADA",
      "TAREFA_VENCENDO",
    ]);

    await expect(
      definirNotificacoesDesativadas(ana.id, ["EQUIPE:CONVITE_RECEBIDO"]),
    ).rejects.toMatchObject({ code: "DADOS_INVALIDOS" });
    // A tentativa recusada não apaga o que já estava salvo.
    expect(await obterNotificacoesDesativadas(ana.id)).toHaveLength(2);
  });
});
