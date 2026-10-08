import { EventKind, ParticipantResponse, ProjectRole, TeamRole } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors.js";
import { prisma } from "../src/lib/prisma.js";
import {
  atividadesDeHoje,
  atualizarEvento,
  convidaveis as listarConvidaveis,
  criarEvento,
  excluirEvento,
  obterEvento,
  proximasAtividades,
  responderReuniao,
  reunioesAgendadas,
  agendaDoPeriodo,
} from "../src/modules/calendar/calendar.service.js";
import { deHorarioDeParede, paraHorarioDeParede } from "../src/modules/calendar/timezone.js";
import { criarTarefa } from "../src/modules/tasks/tasks.service.js";
import { removerMembro } from "../src/modules/projects/projects.service.js";
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

async function erroDe(fn: () => Promise<unknown>) {
  try {
    await fn();
    return null;
  } catch (erro) {
    return erro instanceof AppError ? erro : null;
  }
}

const SP = "America/Sao_Paulo";

/** Horário de parede de hoje, no fuso do teste. */
function hojeAs(hora: number): Date {
  const agora = paraHorarioDeParede(new Date(), SP);
  return deHorarioDeParede({ ...agora, hora, minuto: 0 }, SP);
}

function emDias(dias: number, hora: number): Date {
  const base = paraHorarioDeParede(
    new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
    SP,
  );
  return deHorarioDeParede({ ...base, hora, minuto: 0 }, SP);
}

const atividade = (inicio: Date, titulo = "Atividade") => ({
  kind: EventKind.ATIVIDADE,
  title: titulo,
  startsAt: inicio.toISOString(),
  endsAt: new Date(inicio.getTime() + 60 * 60_000).toISOString(),
  timezone: SP,
});

const reuniao = (inicio: Date, participantIds: string[], titulo = "Reunião") => ({
  kind: EventKind.REUNIAO,
  title: titulo,
  startsAt: inicio.toISOString(),
  endsAt: new Date(inicio.getTime() + 60 * 60_000).toISOString(),
  timezone: SP,
  participantIds,
});

describe("atividades são pessoais", () => {
  it("só quem criou enxerga", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    await criarEvento(eu.id, atividade(hojeAs(10), "Minha atividade"));

    expect(await atividadesDeHoje(eu.id, SP)).toHaveLength(1);
    expect(await atividadesDeHoje(outro.id, SP)).toHaveLength(0);
  });

  it("não aceitam participantes", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();

    const erro = await erroDe(() =>
      criarEvento(eu.id, {
        ...atividade(hojeAs(10)),
        participantIds: [outro.id],
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("não aparecem nas listas de tarefas", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    await criarEvento(eu.id, {
      ...atividade(hojeAs(10), "Preparar apresentação"),
      projectId: projeto.id,
    });

    // Atividade não é tarefa: são coisas separadas, por regra do prompt.
    expect(await prisma.task.count({ where: { projectId: projeto.id } })).toBe(0);
  });
});

describe("seções da agenda", () => {
  it('"hoje" traz só o dia atual', async () => {
    const eu = await criarUsuario();
    await criarEvento(eu.id, atividade(hojeAs(9), "Hoje"));
    await criarEvento(eu.id, atividade(emDias(3, 9), "Depois"));

    const hoje = await atividadesDeHoje(eu.id, SP);
    expect(hoje).toHaveLength(1);
    expect(hoje[0]?.evento.title).toBe("Hoje");
  });

  it('"próximas" não repete o que já está em "hoje"', async () => {
    const eu = await criarUsuario();
    await criarEvento(eu.id, atividade(hojeAs(9), "Hoje"));
    await criarEvento(eu.id, atividade(emDias(2, 9), "Depois"));

    const proximas = await proximasAtividades(eu.id, SP);
    expect(proximas.map((o) => o.evento.title)).toEqual(["Depois"]);
  });

  it("reuniões e atividades não se misturam", async () => {
    const eu = await criarUsuario();
    const colega = await criarUsuario();
    await colegasDeEquipe(eu.id, colega.id);
    await criarEvento(eu.id, atividade(emDias(1, 9), "Atividade"));
    await criarEvento(eu.id, reuniao(emDias(1, 14), [colega.id], "Reunião"));

    expect((await proximasAtividades(eu.id, SP)).map((o) => o.evento.title)).toEqual([
      "Atividade",
    ]);
    expect((await reunioesAgendadas(eu.id)).map((o) => o.evento.title)).toEqual([
      "Reunião",
    ]);
  });

  it("a série recorrente vira várias ocorrências na listagem", async () => {
    const eu = await criarUsuario();
    await criarEvento(eu.id, {
      ...atividade(emDias(1, 9), "Diária"),
      recorrencia: { frequencia: "DIARIA", termino: { tipo: "APOS", ocorrencias: 4 } },
    });

    const proximas = await proximasAtividades(eu.id, SP);
    expect(proximas).toHaveLength(4);
    // Uma linha só no banco: as ocorrências são calculadas.
    expect(await prisma.calendarEvent.count()).toBe(1);
  });
});

describe("reuniões", () => {
  it("o organizador entra já aceito e os convidados ficam pendentes", async () => {
    const organizador = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    const evento = await criarEvento(
      organizador.id,
      reuniao(emDias(1, 14), [convidado.id]),
    );

    const porUsuario = new Map(
      evento.participants.map((p) => [p.user.id, p.response]),
    );
    expect(porUsuario.get(organizador.id)).toBe(ParticipantResponse.ACEITO);
    expect(porUsuario.get(convidado.id)).toBe(ParticipantResponse.PENDENTE);
  });

  it("o convidado vê a reunião e é notificado", async () => {
    const organizador = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    await criarEvento(organizador.id, reuniao(emDias(1, 14), [convidado.id]));

    expect(await reunioesAgendadas(convidado.id)).toHaveLength(1);
    expect(
      await prisma.notification.count({
        where: { userId: convidado.id, type: "REUNIAO_AGENDADA" },
      }),
    ).toBe(1);
  });

  it("a resposta vale para a série inteira", async () => {
    const organizador = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    const evento = await criarEvento(organizador.id, {
      ...reuniao(emDias(1, 14), [convidado.id]),
      recorrencia: { frequencia: "SEMANAL", termino: { tipo: "APOS", ocorrencias: 3 } },
    });

    await responderReuniao(convidado.id, evento.id, ParticipantResponse.ACEITO);

    // Uma resposta só, e não uma por ocorrência.
    const participacoes = await prisma.eventParticipant.findMany({
      where: { userId: convidado.id },
    });
    expect(participacoes).toHaveLength(1);
    expect(participacoes[0]?.response).toBe(ParticipantResponse.ACEITO);
  });

  it("participante vê mas não edita", async () => {
    const organizador = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    const evento = await criarEvento(
      organizador.id,
      reuniao(emDias(1, 14), [convidado.id]),
    );

    expect(await obterEvento(convidado.id, evento.id)).toBeTruthy();
    expect(
      (await erroDe(() => atualizarEvento(convidado.id, evento.id, { title: "Outro" })))
        ?.code,
    ).toBe("SEM_PERMISSAO");
  });

  it("quem não foi convidado não encontra a reunião", async () => {
    const organizador = await criarUsuario();
    const convidado = await criarUsuario();
    await colegasDeEquipe(organizador.id, convidado.id);
    const estranho = await criarUsuario();
    const evento = await criarEvento(
      organizador.id,
      reuniao(emDias(1, 14), [convidado.id]),
    );

    expect((await erroDe(() => obterEvento(estranho.id, evento.id)))?.code).toBe(
      "NAO_ENCONTRADO",
    );
  });
});

describe("alterar série recorrente", () => {
  async function serieDiaria() {
    const eu = await criarUsuario();
    const evento = await criarEvento(eu.id, {
      ...atividade(emDias(1, 9), "Série"),
      recorrencia: { frequencia: "DIARIA", termino: { tipo: "APOS", ocorrencias: 5 } },
    });
    return { eu, evento };
  }

  it('"só esta" move uma ocorrência e deixa as outras', async () => {
    const { eu, evento } = await serieDiaria();
    const ocorrencias = await proximasAtividades(eu.id, SP);
    const terceira = ocorrencias[2]!;

    const novoInicio = new Date(terceira.inicio.getTime() + 5 * 60 * 60_000);
    await atualizarEvento(eu.id, evento.id, {
      escopo: "SO_ESTA",
      ocorrencia: terceira.inicioOriginal.toISOString(),
      startsAt: novoInicio.toISOString(),
    });

    const depois = await proximasAtividades(eu.id, SP);
    expect(depois).toHaveLength(5);

    const movida = depois.find((o) => o.modificada);
    expect(movida?.inicio.getTime()).toBe(novoInicio.getTime());
    // As demais ficam no horário original.
    expect(depois.filter((o) => o.modificada)).toHaveLength(1);
  });

  it('"só esta" ao excluir cancela apenas aquela ocorrência', async () => {
    const { eu, evento } = await serieDiaria();
    const segunda = (await proximasAtividades(eu.id, SP))[1]!;

    await excluirEvento(eu.id, evento.id, {
      escopo: "SO_ESTA",
      ocorrencia: segunda.inicioOriginal.toISOString(),
    });

    const depois = await proximasAtividades(eu.id, SP);
    expect(depois).toHaveLength(4);
    expect(await prisma.calendarEvent.count()).toBe(1);
  });

  it('"esta e as seguintes" divide em duas séries', async () => {
    const { eu, evento } = await serieDiaria();
    const terceira = (await proximasAtividades(eu.id, SP))[2]!;

    await atualizarEvento(eu.id, evento.id, {
      escopo: "ESTA_E_SEGUINTES",
      ocorrencia: terceira.inicioOriginal.toISOString(),
      title: "Série nova",
    });

    expect(await prisma.calendarEvent.count()).toBe(2);

    const depois = await proximasAtividades(eu.id, SP);
    const titulos = depois.map((o) => o.evento.title);
    // As duas primeiras mantêm o título antigo; as demais, o novo.
    expect(titulos.slice(0, 2)).toEqual(["Série", "Série"]);
    expect(titulos.slice(2).every((t) => t === "Série nova")).toBe(true);
  });

  it('"esta e as seguintes" ao excluir encurta a série', async () => {
    const { eu, evento } = await serieDiaria();
    const terceira = (await proximasAtividades(eu.id, SP))[2]!;

    await excluirEvento(eu.id, evento.id, {
      escopo: "ESTA_E_SEGUINTES",
      ocorrencia: terceira.inicioOriginal.toISOString(),
    });

    expect(await proximasAtividades(eu.id, SP)).toHaveLength(2);
  });

  it('"todas" altera a série inteira', async () => {
    const { eu, evento } = await serieDiaria();

    await atualizarEvento(eu.id, evento.id, { escopo: "TODAS", title: "Renomeada" });

    const depois = await proximasAtividades(eu.id, SP);
    expect(depois.every((o) => o.evento.title === "Renomeada")).toBe(true);
  });

  it("alterar a regra descarta exceções que não fazem mais sentido", async () => {
    const { eu, evento } = await serieDiaria();
    const segunda = (await proximasAtividades(eu.id, SP))[1]!;

    await excluirEvento(eu.id, evento.id, {
      escopo: "SO_ESTA",
      ocorrencia: segunda.inicioOriginal.toISOString(),
    });
    expect(await prisma.eventException.count()).toBe(1);

    await atualizarEvento(eu.id, evento.id, {
      escopo: "TODAS",
      recorrencia: { frequencia: "SEMANAL", termino: { tipo: "APOS", ocorrencias: 3 } },
    });

    // As exceções apontavam para ocorrências que a nova regra não gera.
    expect(await prisma.eventException.count()).toBe(0);
  });
});

describe("vínculo com projeto e tarefa", () => {
  it("aceita vincular a uma tarefa acessível", async () => {
    const eu = await criarUsuario();
    const projeto = await criarProjeto(eu.id);
    const tarefa = await criarTarefa(eu.id, {
      projectId: projeto.id,
      title: "Preparar",
    });

    const evento = await criarEvento(eu.id, {
      ...atividade(hojeAs(10)),
      taskId: tarefa.id,
    });
    expect(evento.taskId).toBe(tarefa.id);
  });

  it("recusa vincular a tarefa de projeto sem acesso", async () => {
    const eu = await criarUsuario();
    const outro = await criarUsuario();
    const alheio = await criarProjeto(outro.id);
    const tarefa = await criarTarefa(outro.id, {
      projectId: alheio.id,
      title: "Secreta",
    });

    const erro = await erroDe(() =>
      criarEvento(eu.id, { ...atividade(hojeAs(10)), taskId: tarefa.id }),
    );
    expect(erro?.code).toBe("NAO_ENCONTRADO");
  });

  it("perder o acesso ao projeto esconde o vínculo, não o evento", async () => {
    const dono = await criarUsuario();
    const membro = await criarUsuario();
    const projeto = await criarProjeto(dono.id);
    await adicionarAoProjeto(projeto.id, membro.id, ProjectRole.EDITOR);

    const evento = await criarEvento(membro.id, {
      ...atividade(hojeAs(10)),
      projectId: projeto.id,
    });
    expect((await obterEvento(membro.id, evento.id)).vinculo).not.toBeNull();

    await removerMembro(dono.id, projeto.id, membro.id);

    // A atividade continua sendo dele; só o nome do projeto some.
    const depois = await obterEvento(membro.id, evento.id);
    expect(depois.vinculo).toBeNull();
    expect(depois.title).toBe("Atividade");
  });
});

describe("validação", () => {
  it("recusa término anterior ao início", async () => {
    const eu = await criarUsuario();
    const inicio = hojeAs(14);

    const erro = await erroDe(() =>
      criarEvento(eu.id, {
        kind: EventKind.ATIVIDADE,
        title: "Invertida",
        startsAt: inicio.toISOString(),
        endsAt: new Date(inicio.getTime() - 60_000).toISOString(),
        timezone: SP,
      }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });

  it("recusa fuso desconhecido", async () => {
    const eu = await criarUsuario();

    const erro = await erroDe(() =>
      criarEvento(eu.id, { ...atividade(hojeAs(10)), timezone: "Marte/Olympus" }),
    );
    expect(erro?.code).toBe("REGRA_DE_NEGOCIO");
  });
});

describe("convidáveis", () => {
  it("são as pessoas que dividem alguma equipe comigo", async () => {
    const eu = await criarUsuario();
    const colega = await criarUsuario();
    await criarUsuario(); // sem equipe em comum
    const equipe = await criarEquipe(eu.id);
    await adicionarAEquipe(equipe.id, colega.id, TeamRole.MEMBRO);

    const lista = await listarConvidaveis(eu.id);
    expect(lista.map((u) => u.id)).toEqual([colega.id]);
  });
});

describe("agenda de um período", () => {
  it("devolve as ocorrências ordenadas por início", async () => {
    const eu = await criarUsuario();
    await criarEvento(eu.id, atividade(emDias(3, 9), "C"));
    await criarEvento(eu.id, atividade(emDias(1, 9), "A"));
    await criarEvento(eu.id, atividade(emDias(2, 9), "B"));

    const lista = await agendaDoPeriodo(eu.id, new Date(), emDias(10, 23));
    expect(lista.map((o) => o.evento.title)).toEqual(["A", "B", "C"]);
  });
});
